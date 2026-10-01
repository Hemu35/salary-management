# frozen_string_literal: true

require "csv"

class ImportJobWorker
  include Sidekiq::Job

  sidekiq_options queue: :imports, retry: 3

  BATCH_SIZE = 500

  def perform(import_job_id)
    job = ImportJob.find_by(id: import_job_id)
    return unless job
    return if job.cancelled?

    job.update!(status: "processing", started_at: Time.current)

    unless File.exist?(job.file_path)
      job.update!(
        status: "failed",
        completed_at: Time.current,
        error_summary: [ { "row" => 0, "errors" => [ "Import file not found on disk" ] } ]
      )
      return
    end

    # Establish session-level tenant isolation context on the Sidekiq DB connection
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(
        [ "SELECT set_config('app.current_tenant_id', ?, false)", job.tenant_id.to_s ]
      )
    )

    begin
      requester = job.user
      accessible_domain_ids = requester.accessible_domain_ids
      domains_by_name = Domain.where(tenant_id: job.tenant_id).all.index_by { |d| d.name.to_s.strip.downcase }

      # Read CSV rows
      csv_rows = []
      CSV.foreach(job.file_path, headers: true) do |row|
        csv_rows << row
      end

      total_rows = csv_rows.length
      job.update_columns(total_rows: total_rows)

      successful_rows = 0
      failed_rows = 0
      error_summary = []

      created_employee_ids = []
      updated_employees = []
      created_compensation_ids = []
      superseded_compensation_ids = []

      csv_rows.each_slice(BATCH_SIZE).with_index do |batch, batch_idx|
        # Periodic check for cancellation
        job.reload
        if job.cancelling? || job.cancelled?
          job.update_columns(rollback_metadata: {
            "created_employee_ids" => created_employee_ids,
            "updated_employees" => updated_employees,
            "created_compensation_ids" => created_compensation_ids,
            "superseded_compensation_ids" => superseded_compensation_ids
          })
          ImportRollbackService.call(job)
          return
        end

        batch_offset = (batch_idx * BATCH_SIZE) + 2 # Header is row 1, data starts at row 2

        # 1. In-memory validation phase for batch
        valid_items = []
        batch.each_with_index do |row, idx|
          row_num = batch_offset + idx
          row_errors = validate_row(row, requester, accessible_domain_ids, domains_by_name)

          if row_errors.any?
            failed_rows += 1
            error_summary << {
              "row" => row_num,
              "employee_number" => row["employee_number"].to_s.strip,
              "errors" => row_errors
            }
          else
            valid_items << { row: row, row_num: row_num }
          end
        end

        next if valid_items.empty?

        # 2. Batch database processing
        begin
          process_valid_batch(
            valid_items,
            job,
            requester,
            domains_by_name,
            created_employee_ids,
            updated_employees,
            created_compensation_ids,
            superseded_compensation_ids
          )
          successful_rows += valid_items.size
        rescue StandardError => e
          Rails.logger.warn("ImportJobWorker: Batch bulk processing failed (#{e.message}). Falling back to row-by-row.")
          # Fallback to row-by-row for this batch if bulk query fails
          valid_items.each do |item|
            row = item[:row]
            row_num = item[:row_num]
            row_errors = []

            ActiveRecord::Base.transaction do
              domain = domains_by_name[(row["domain_name"] || row["department"]).to_s.strip.downcase]
              emp = Employee.find_or_initialize_by(tenant_id: job.tenant_id, employee_number: row["employee_number"].to_s.strip)
              is_new = emp.new_record?
              prev_attrs = is_new ? nil : emp.attributes.slice("domain_id", "first_name", "last_name", "email", "country_code", "job_title", "employment_status", "hire_date")

              emp.assign_attributes(
                domain: domain,
                first_name: row["first_name"].to_s.strip,
                last_name: row["last_name"].to_s.strip,
                email: row["email"].to_s.strip.downcase,
                country_code: (row["country_code"] || "US").to_s.strip.upcase,
                job_title: row["job_title"].to_s.strip,
                employment_status: (row["employment_status"] || "active").to_s.strip.downcase,
                hire_date: row["hire_date"].presence || Date.current
              )

              if emp.save
                if is_new
                  created_employee_ids << emp.id
                else
                  updated_employees << { "id" => emp.id, "previous" => prev_attrs }
                end

                if row["base_salary"].present?
                  eff_date = row["effective_date"].presence || emp.hire_date || Date.current
                  currency = (row["currency"].presence || "USD").to_s.strip.upcase
                  pay_freq = (row["pay_frequency"].presence || "annual").to_s.strip.downcase

                  rec = CompensationRecord.find_or_initialize_by(tenant_id: job.tenant_id, employee_id: emp.id, effective_date: eff_date)
                  is_new_rec = rec.new_record?

                  prev_active = CompensationRecord.where(tenant_id: job.tenant_id, employee_id: emp.id, status: "active").where.not(id: rec.id)
                  superseded_compensation_ids.concat(prev_active.pluck(:id))
                  prev_active.update_all(status: "superseded")

                  rec.assign_attributes(currency: currency, pay_frequency: pay_freq, status: "active", created_by_id: requester.id, notes: row["notes"].presence || "Imported via CSV batch")
                  rec.save!
                  rec.compensation_components.destroy_all

                  created_compensation_ids << rec.id if is_new_rec && !is_new

                  CompensationComponent.create!(tenant_id: job.tenant_id, compensation_record_id: rec.id, component_type: "base_salary", amount: BigDecimal(row["base_salary"].to_s), frequency: pay_freq)
                  CompensationComponent.create!(tenant_id: job.tenant_id, compensation_record_id: rec.id, component_type: "bonus", amount: BigDecimal(row["bonus"].to_s), frequency: "annual") if row["bonus"].to_f > 0
                  CompensationComponent.create!(tenant_id: job.tenant_id, compensation_record_id: rec.id, component_type: "commission", amount: BigDecimal(row["commission"].to_s), frequency: "annual") if row["commission"].to_f > 0
                  CompensationComponent.create!(tenant_id: job.tenant_id, compensation_record_id: rec.id, component_type: "allowance", amount: BigDecimal(row["allowance"].to_s), frequency: "annual") if row["allowance"].to_f > 0
                end
              else
                row_errors.concat(emp.errors.full_messages)
                raise ActiveRecord::Rollback
              end
            end

            if row_errors.any?
              failed_rows += 1
              error_summary << { "row" => row_num, "employee_number" => row["employee_number"].to_s.strip, "errors" => row_errors }
            else
              successful_rows += 1
            end
          end
        end

        # Progress commit for UI polling
        current_processed = [ (batch_idx + 1) * BATCH_SIZE, total_rows ].min
        job.update_columns(
          processed_rows: current_processed,
          successful_rows: successful_rows,
          failed_rows: failed_rows
        )
      end

      final_status = if failed_rows.zero?
                       "completed"
                     elsif successful_rows.positive?
                       "completed_with_errors"
                     else
                       "failed"
                     end

      job.update!(
        status: final_status,
        processed_rows: total_rows,
        successful_rows: successful_rows,
        failed_rows: failed_rows,
        error_summary: error_summary,
        rollback_metadata: {
          "created_employee_ids" => created_employee_ids,
          "updated_employees" => updated_employees,
          "created_compensation_ids" => created_compensation_ids,
          "superseded_compensation_ids" => superseded_compensation_ids
        },
        completed_at: Time.current
      )
    ensure
      ActiveRecord::Base.connection.execute("SELECT set_config('app.current_tenant_id', '', false)") rescue nil
    end
  end

  private

  def validate_row(row, requester, accessible_domain_ids, domains_by_name)
    errors = []
    emp_num = row["employee_number"].to_s.strip
    first_name = row["first_name"].to_s.strip
    last_name = row["last_name"].to_s.strip
    email = row["email"].to_s.strip
    raw_domain = (row["domain_name"] || row["department"]).to_s.strip
    country = (row["country_code"] || "US").to_s.strip.upcase
    status = (row["employment_status"] || "active").to_s.strip.downcase

    errors << "Employee number can't be blank" if emp_num.blank?
    errors << "First name can't be blank" if first_name.blank?
    errors << "Last name can't be blank" if last_name.blank?
    errors << "Email can't be blank" if email.blank?
    errors << "Email is invalid" if email.present? && !(email =~ URI::MailTo::EMAIL_REGEXP)
    errors << "Country code must be a valid 2-letter ISO country code" if country.present? && !(country =~ /\A[A-Z]{2}\z/)
    errors << "Employment status is not included in the list" if status.present? && !Employee::STATUSES.include?(status)

    domain = domains_by_name[raw_domain.downcase]
    if domain.nil?
      errors << "Domain '#{raw_domain}' does not exist"
    elsif requester.hr_manager? && !accessible_domain_ids.include?(domain.id)
      errors << "Access denied: Domain '#{domain.name}' is outside your assigned scope"
    end

    errors
  end

  def process_valid_batch(valid_items, job, requester, domains_by_name, created_employee_ids, updated_employees, created_compensation_ids, superseded_compensation_ids)
    tenant_id = job.tenant_id
    now = Time.current

    emp_nums = valid_items.map { |i| i[:row]["employee_number"].to_s.strip }
    existing_emps = Employee.where(tenant_id: tenant_id, employee_number: emp_nums).index_by(&:employee_number)

    ActiveRecord::Base.transaction do
      new_emp_rows = []
      emp_id_by_number = {}

      valid_items.each do |item|
        row = item[:row]
        emp_num = row["employee_number"].to_s.strip
        raw_domain = (row["domain_name"] || row["department"]).to_s.strip
        domain = domains_by_name[raw_domain.downcase]
        existing = existing_emps[emp_num]

        if existing
          updated_employees << {
            "id" => existing.id,
            "previous" => existing.attributes.slice("domain_id", "first_name", "last_name", "email", "country_code", "job_title", "employment_status", "hire_date")
          }
          existing.update_columns(
            domain_id: domain.id,
            first_name: row["first_name"].to_s.strip,
            last_name: row["last_name"].to_s.strip,
            email: row["email"].to_s.strip.downcase,
            country_code: (row["country_code"] || "US").to_s.strip.upcase,
            job_title: row["job_title"].to_s.strip,
            employment_status: (row["employment_status"] || "active").to_s.strip.downcase,
            hire_date: row["hire_date"].presence || existing.hire_date || Date.current,
            updated_at: now
          )
          emp_id_by_number[emp_num] = existing.id
        else
          new_emp_rows << {
            tenant_id: tenant_id,
            domain_id: domain.id,
            employee_number: emp_num,
            first_name: row["first_name"].to_s.strip,
            last_name: row["last_name"].to_s.strip,
            email: row["email"].to_s.strip.downcase,
            country_code: (row["country_code"] || "US").to_s.strip.upcase,
            job_title: row["job_title"].to_s.strip,
            employment_status: (row["employment_status"] || "active").to_s.strip.downcase,
            hire_date: row["hire_date"].presence || Date.current,
            created_at: now,
            updated_at: now
          }
        end
      end

      if new_emp_rows.any?
        inserted = Employee.insert_all(new_emp_rows, returning: %i[id employee_number])
        inserted.rows.each do |row|
          emp_id = row[0]
          emp_num = row[1]
          emp_id_by_number[emp_num] = emp_id
          created_employee_ids << emp_id
        end
      end

      # Process Compensation
      comp_items = valid_items.select { |i| i[:row]["base_salary"].present? }
      if comp_items.any?
        target_emp_ids = comp_items.map { |i| emp_id_by_number[i[:row]["employee_number"].to_s.strip] }.compact

        # Supersede active compensation records for existing employees
        prev_active_records = CompensationRecord.where(tenant_id: tenant_id, employee_id: target_emp_ids, status: "active")
        superseded_compensation_ids.concat(prev_active_records.pluck(:id))
        prev_active_records.update_all(status: "superseded")

        comp_record_rows = []
        comp_metadata = []

        comp_items.each do |item|
          row = item[:row]
          emp_num = row["employee_number"].to_s.strip
          emp_id = emp_id_by_number[emp_num]
          next unless emp_id

          eff_date = row["effective_date"].presence || row["hire_date"].presence || Date.current
          currency = (row["currency"].presence || "USD").to_s.strip.upcase
          pay_freq = (row["pay_frequency"].presence || "annual").to_s.strip.downcase

          comp_record_rows << {
            tenant_id: tenant_id,
            employee_id: emp_id,
            effective_date: eff_date,
            currency: currency,
            pay_frequency: pay_freq,
            status: "active",
            created_by_id: requester.id,
            notes: row["notes"].presence || "Imported via CSV batch",
            created_at: now,
            updated_at: now
          }

          comp_metadata << {
            emp_id: emp_id,
            base_salary: row["base_salary"],
            bonus: row["bonus"],
            commission: row["commission"],
            allowance: row["allowance"],
            pay_freq: pay_freq
          }
        end

        if comp_record_rows.any?
          inserted_comps = CompensationRecord.insert_all(comp_record_rows, returning: %i[id employee_id])
          comp_id_by_emp_id = inserted_comps.rows.to_h { |row| [row[1], row[0]] }

          component_rows = []
          comp_metadata.each do |meta|
            comp_rec_id = comp_id_by_emp_id[meta[:emp_id]]
            next unless comp_rec_id

            component_rows << {
              tenant_id: tenant_id,
              compensation_record_id: comp_rec_id,
              component_type: "base_salary",
              amount: BigDecimal(meta[:base_salary].to_s),
              frequency: meta[:pay_freq],
              created_at: now,
              updated_at: now
            }

            if meta[:bonus].to_f > 0
              component_rows << {
                tenant_id: tenant_id,
                compensation_record_id: comp_rec_id,
                component_type: "bonus",
                amount: BigDecimal(meta[:bonus].to_s),
                frequency: "annual",
                created_at: now,
                updated_at: now
              }
            end

            if meta[:commission].to_f > 0
              component_rows << {
                tenant_id: tenant_id,
                compensation_record_id: comp_rec_id,
                component_type: "commission",
                amount: BigDecimal(meta[:commission].to_s),
                frequency: "annual",
                created_at: now,
                updated_at: now
              }
            end

            if meta[:allowance].to_f > 0
              component_rows << {
                tenant_id: tenant_id,
                compensation_record_id: comp_rec_id,
                component_type: "allowance",
                amount: BigDecimal(meta[:allowance].to_s),
                frequency: "annual",
                created_at: now,
                updated_at: now
              }
            end
          end

          CompensationComponent.insert_all(component_rows) if component_rows.any?
        end
      end
    end
  end
end
