require "csv"
require "fileutils"

class ExportJobWorker
  include Sidekiq::Job

  sidekiq_options queue: :exports, retry: 3

  def perform(export_job_id)
    job = ExportJob.find_by(id: export_job_id)
    return unless job

    job.update!(status: "processing", started_at: Time.current)

    # Establish session-level tenant isolation context on the Sidekiq DB connection
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(
        [ "SELECT set_config('app.current_tenant_id', ?, false)", job.tenant_id.to_s ]
      )
    )

    begin
      requester = job.user
      accessible_domain_ids = requester.accessible_domain_ids
      filters = job.filters || {}

      # Base scope restricted to tenant and user's accessible domain boundary
      scope = Employee.where(tenant_id: job.tenant_id)
                      .where(domain_id: accessible_domain_ids)
                      .includes(:domain, compensation_records: :compensation_components)
                      .order(:employee_number)

      # Apply requested filters
      if filters["domain_id"].present? && filters["domain_id"] != "all"
        scope = scope.where(domain_id: filters["domain_id"])
      end

      if filters["employment_status"].present? && filters["employment_status"] != "all"
        scope = scope.where(employment_status: filters["employment_status"])
      end

      if filters["search"].present?
        term = "%#{filters['search'].to_s.strip}%"
        scope = scope.where(
          "first_name ILIKE :term OR last_name ILIKE :term OR email ILIKE :term OR employee_number ILIKE :term",
          term: term
        )
      end

      if filters["employee_ids"].present? && filters["employee_ids"].is_a?(Array) && filters["employee_ids"].any?
        scope = scope.where(id: filters["employee_ids"])
      end

      total_rows = scope.count
      job.update!(total_rows: total_rows)

      storage_dir = Rails.root.join("storage", "exports")
      FileUtils.mkdir_p(storage_dir)

      file_path = storage_dir.join("#{job.tenant_id}_#{job.id}_#{job.filename}")

      headers = [
        "employee_number",
        "first_name",
        "last_name",
        "email",
        "domain_name",
        "country_code",
        "job_title",
        "employment_status",
        "hire_date",
        "effective_date",
        "currency",
        "pay_frequency",
        "base_salary",
        "bonus",
        "allowance",
        "total_annualized_compensation"
      ]

      processed_count = 0

      CSV.open(file_path, "w", write_headers: true, headers: headers) do |csv|
        scope.find_each(batch_size: 1_000) do |emp|
          active_comp = emp.compensation_records.find { |r| r.status == "active" }

          base_comp = active_comp&.compensation_components&.find { |c| c.component_type == "base_salary" }
          bonus_comp = active_comp&.compensation_components&.find { |c| c.component_type == "bonus" }
          allowance_comp = active_comp&.compensation_components&.find { |c| c.component_type == "allowance" }

          base_salary = base_comp&.amount || 0.0
          bonus = bonus_comp&.amount || 0.0
          allowance = allowance_comp&.amount || 0.0
          total_comp = active_comp ? (base_salary + bonus + allowance) : 0.0

          csv << [
            emp.employee_number,
            emp.first_name,
            emp.last_name,
            emp.email,
            emp.domain&.name,
            emp.country_code,
            emp.job_title,
            emp.employment_status,
            emp.hire_date&.to_s,
            active_comp&.effective_date&.to_s,
            active_comp&.currency || "USD",
            active_comp&.pay_frequency || "annual",
            sprintf("%.2f", base_salary),
            sprintf("%.2f", bonus),
            sprintf("%.2f", allowance),
            sprintf("%.2f", total_comp)
          ]

          processed_count += 1
          if (processed_count % 250).zero? || processed_count == total_rows
            job.update_columns(processed_rows: processed_count)
          end
        end
      end

      job.update!(
        status: "completed",
        file_path: file_path.to_s,
        processed_rows: processed_count,
        total_rows: total_rows,
        completed_at: Time.current,
        expires_at: 24.hours.from_now
      )
    rescue => e
      job.update!(
        status: "failed",
        error_message: e.message,
        completed_at: Time.current
      )
      raise e
    ensure
      # Reset tenant isolation setting on the connection
      ActiveRecord::Base.connection.execute(
        "SELECT set_config('app.current_tenant_id', '', false)"
      )
    end
  end
end
