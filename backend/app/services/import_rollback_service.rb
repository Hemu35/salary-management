class ImportRollbackService
  def self.call(import_job)
    new(import_job).call
  end

  def initialize(import_job)
    @import_job = import_job
    @tenant = import_job.tenant
  end

  def call
    @tenant.with_tenant_context do
      ActiveRecord::Base.transaction do
        meta = @import_job.rollback_metadata || {}

        # 1. Delete compensation records created for existing employees
        comp_ids = Array.wrap(meta["created_compensation_ids"]).compact
        if comp_ids.any?
          @tenant.compensation_records.where(id: comp_ids).destroy_all
        end

        # 2. Restore superseded compensation records back to active
        superseded_ids = Array.wrap(meta["superseded_compensation_ids"]).compact
        if superseded_ids.any?
          @tenant.compensation_records.where(id: superseded_ids).update_all(status: "active")
        end

        # 3. Restore updated employees to their previous attributes
        updated_emps = Array.wrap(meta["updated_employees"]).compact
        updated_emps.each do |item|
          emp = @tenant.employees.find_by(id: item["id"])
          if emp && item["previous"].is_a?(Hash)
            emp.update_columns(item["previous"])
          end
        end

        # 4. Delete newly created employees (cascades to all compensation records and components)
        emp_ids = Array.wrap(meta["created_employee_ids"]).compact
        if emp_ids.any?
          @tenant.employees.where(id: emp_ids).destroy_all
        end

        # 5. Determine resulting status
        target_status = if @import_job.cancelling? || @import_job.queued? || @import_job.processing?
                          "cancelled"
                        else
                          "rolled_back"
                        end

        @import_job.update!(
          status: target_status,
          completed_at: Time.current
        )

        true
      end
    end
  end
end
