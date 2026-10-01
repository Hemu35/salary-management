require "csv"

class ImportJobWorker
  include Sidekiq::Job

  sidekiq_options queue: :imports, retry: 3

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

    total_rows = 0
    successful_rows = 0
    failed_rows = 0
    error_summary = []

    created_employee_ids = []
    updated_employees = []
    created_compensation_ids = []
    superseded_compensation_ids = []

    lines = CSV.read(job.file_path, headers: true)
    total_rows = lines.length
    job.update!(total_rows: total_rows)

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

      lines.each_with_index do |row, index|
        # Check if cancellation was requested during processing
        if (index % 5).zero?
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
        end

        row_num = index + 2 # Header is row 1
        row_errors = []

        ActiveRecord::Base.transaction do
          raw_domain_name = (row["domain_name"] || row["department"]).to_s.strip
          domain = domains_by_name[raw_domain_name.downcase]

          if domain.nil?
            row_errors << "Domain '#{raw_domain_name}' does not exist"
          elsif requester.hr_manager? && !accessible_domain_ids.include?(domain.id)
            row_errors << "Access denied: Domain '#{domain.name}' is outside your assigned scope"
          end

          if row_errors.empty?
            emp = Employee.find_or_initialize_by(
              tenant_id: job.tenant_id,
              employee_number: row["employee_number"].to_s.strip
            )
            is_new_emp = emp.new_record?
            prev_emp_attributes = if is_new_emp
                                    nil
                                  else
                                    emp.attributes.slice("domain_id", "first_name", "last_name", "email", "country_code", "job_title", "employment_status", "hire_date")
                                  end

            emp.assign_attributes(
              domain: domain,
              first_name: row["first_name"].to_s.strip,
              last_name: row["last_name"].to_s.strip,
              email: row["email"].to_s.strip,
              country_code: (row["country_code"] || "US").to_s.strip.upcase,
              job_title: row["job_title"].to_s.strip,
              employment_status: (row["employment_status"] || "active").to_s.strip.downcase,
              hire_date: row["hire_date"].presence || Date.current
            )

            if emp.save
              if is_new_emp
                created_employee_ids << emp.id
              else
                updated_employees << { "id" => emp.id, "previous" => prev_emp_attributes }
              end

              base_salary = row["base_salary"].presence
              if base_salary.present?
                eff_date = row["effective_date"].presence || emp.hire_date || Date.current
                currency = (row["currency"].presence || "USD").to_s.strip.upcase
                pay_freq = (row["pay_frequency"].presence || "annual").to_s.strip.downcase

                rec = CompensationRecord.find_or_initialize_by(
                  tenant_id: job.tenant_id,
                  employee_id: emp.id,
                  effective_date: eff_date
                )
                is_new_rec = rec.new_record?

                prev_active = CompensationRecord.where(tenant_id: job.tenant_id, employee_id: emp.id, status: "active")
                                                .where.not(id: rec.id)
                superseded_compensation_ids.concat(prev_active.pluck(:id))
                prev_active.update_all(status: "superseded")

                rec.assign_attributes(
                  currency: currency,
                  pay_frequency: pay_freq,
                  status: "active",
                  created_by_id: requester.id,
                  notes: row["notes"].presence || "Imported via CSV batch"
                )
                rec.save!
                rec.compensation_components.destroy_all

                if is_new_rec && !is_new_emp
                  created_compensation_ids << rec.id
                end

                CompensationComponent.create!(
                  tenant_id: job.tenant_id,
                  compensation_record_id: rec.id,
                  component_type: "base_salary",
                  amount: BigDecimal(base_salary.to_s),
                  frequency: pay_freq
                )

                if row["bonus"].present? && row["bonus"].to_f > 0
                  CompensationComponent.create!(
                    tenant_id: job.tenant_id,
                    compensation_record_id: rec.id,
                    component_type: "bonus",
                    amount: BigDecimal(row["bonus"].to_s),
                    frequency: "annual"
                  )
                end

                if row["commission"].present? && row["commission"].to_f > 0
                  CompensationComponent.create!(
                    tenant_id: job.tenant_id,
                    compensation_record_id: rec.id,
                    component_type: "commission",
                    amount: BigDecimal(row["commission"].to_s),
                    frequency: "annual"
                  )
                end

                if row["allowance"].present? && row["allowance"].to_f > 0
                  CompensationComponent.create!(
                    tenant_id: job.tenant_id,
                    compensation_record_id: rec.id,
                    component_type: "allowance",
                    amount: BigDecimal(row["allowance"].to_s),
                    frequency: "annual"
                  )
                end
              end
            else
              row_errors.concat(emp.errors.full_messages)
            end
          end

          if row_errors.any?
            raise ActiveRecord::Rollback
          end
        rescue ActiveRecord::RecordInvalid => e
          row_errors.concat(e.record.errors.full_messages)
          raise ActiveRecord::Rollback
        rescue StandardError => e
          row_errors << e.message
          raise ActiveRecord::Rollback
        end

        if row_errors.any?
          failed_rows += 1
          error_summary << { "row" => row_num, "employee_number" => row["employee_number"].to_s.strip, "errors" => row_errors }
        else
          successful_rows += 1
        end

        # Immediately commit progress to database so UI polling displays real-time advancement
        if ((index + 1) % 10).zero? || (index + 1) == total_rows
          job.update_columns(
            processed_rows: index + 1,
            successful_rows: successful_rows,
            failed_rows: failed_rows,
            rollback_metadata: {
              "created_employee_ids" => created_employee_ids,
              "updated_employees" => updated_employees,
              "created_compensation_ids" => created_compensation_ids,
              "superseded_compensation_ids" => superseded_compensation_ids
            }
          )
        end
      end
    ensure
      ActiveRecord::Base.connection.execute("SELECT set_config('app.current_tenant_id', '', false)") rescue nil
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
  end
end
