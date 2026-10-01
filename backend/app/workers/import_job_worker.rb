require "csv"

class ImportJobWorker
  include Sidekiq::Job

  sidekiq_options queue: :imports, retry: 3

  def perform(import_job_id)
    job = ImportJob.find_by(id: import_job_id)
    return unless job

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

    lines = CSV.read(job.file_path, headers: true)
    total_rows = lines.length
    job.update!(total_rows: total_rows)

    Tenant.with_tenant_context(job.tenant_id) do
      requester = job.user
      accessible_domain_ids = requester.accessible_domain_ids

      lines.each_with_index do |row, index|
        row_num = index + 2 # Header is row 1
        row_errors = []

        ActiveRecord::Base.transaction(requires_new: true) do
          domain_name = row["domain_name"] || row["department"]
          domain = Domain.where(tenant_id: job.tenant_id)
                         .where("LOWER(name) = ?", domain_name.to_s.strip.downcase)
                         .first

          if domain.nil?
            row_errors << "Domain '#{domain_name}' does not exist"
          elsif requester.hr_manager? && !accessible_domain_ids.include?(domain.id)
            row_errors << "Access denied: Domain '#{domain.name}' is outside your assigned scope"
          end

          if row_errors.empty?
            emp = Employee.find_or_initialize_by(
              tenant_id: job.tenant_id,
              employee_number: row["employee_number"].to_s.strip
            )

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
              base_salary = row["base_salary"].presence
              if base_salary.present?
                eff_date = row["effective_date"].presence || emp.hire_date || Date.current
                currency = (row["currency"].presence || "USD").to_s.strip.upcase
                pay_freq = (row["pay_frequency"].presence || "annual").to_s.strip.downcase

                CompensationRecord.where(tenant_id: job.tenant_id, employee_id: emp.id, status: "active")
                                  .update_all(status: "superseded")

                rec = CompensationRecord.create!(
                  tenant_id: job.tenant_id,
                  employee_id: emp.id,
                  effective_date: eff_date,
                  currency: currency,
                  pay_frequency: pay_freq,
                  status: "active",
                  created_by_id: requester.id,
                  notes: row["notes"].presence || "Imported via CSV batch"
                )

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
        end

        if row_errors.any?
          failed_rows += 1
          error_summary << { "row" => row_num, "employee_number" => row["employee_number"].to_s.strip, "errors" => row_errors }
        else
          successful_rows += 1
        end

        if ((index + 1) % 20).zero?
          job.update!(
            processed_rows: index + 1,
            successful_rows: successful_rows,
            failed_rows: failed_rows
          )
        end
      end
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
      completed_at: Time.current
    )
  end
end
