module Api
  class CompensationsController < BaseController
    before_action :set_employee

    # GET /api/employees/:employee_id/compensation
    def index
      with_tenant_context do
        records = @employee.compensation_records
                           .includes(:compensation_components, :created_by, :approved_by)
                           .order(effective_date: :desc)

        render json: {
          compensation_records: records.map { |r| serialize_compensation(r) }
        }, status: :ok
      end
    end

    # POST /api/employees/:employee_id/compensation
    def create
      with_tenant_context do
        components_params = params.dig(:compensation, :components) || []
        clean_params = compensation_params.except(:components)

        record = nil
        success = false

        ActiveRecord::Base.transaction do
          # When setting a record to active, supersede any existing active records
          if clean_params[:status] == "active"
            @employee.compensation_records.where(status: "active").update_all(status: "superseded")
          end

          record = @employee.compensation_records.build(
            clean_params.merge(
              tenant: current_tenant,
              created_by: current_user
            )
          )

          components_params.each do |c_param|
            record.compensation_components.build(
              tenant: current_tenant,
              component_type: c_param[:component_type],
              amount: c_param[:amount],
              percentage: c_param[:percentage],
              frequency: c_param[:frequency] || "annual"
            )
          end

          if record.save
            success = true
          else
            raise ActiveRecord::Rollback
          end
        end

        if success
          render json: serialize_compensation(record), status: :created
        else
          render json: { errors: record.errors.full_messages }, status: :unprocessable_content
        end
      end
    end

    # PATCH/PUT /api/employees/:employee_id/compensation/:id
    def update
      with_tenant_context do
        record = @employee.compensation_records.find_by(id: params[:id])
        return render_not_found unless record

        components_params = params.dig(:compensation, :components)
        clean_params = compensation_params.except(:components)

        success = false

        ActiveRecord::Base.transaction do
          # If transitioning status to active, supersede all other active records for this employee
          if clean_params[:status] == "active" && record.status != "active"
            @employee.compensation_records.where(status: "active").where.not(id: record.id).update_all(status: "superseded")
          end

          record.assign_attributes(clean_params)

          if components_params.present?
            record.compensation_components.destroy_all
            components_params.each do |c_param|
              record.compensation_components.build(
                tenant: current_tenant,
                component_type: c_param[:component_type],
                amount: c_param[:amount],
                percentage: c_param[:percentage],
                frequency: c_param[:frequency] || "annual"
              )
            end
          end

          if record.save
            success = true
          else
            raise ActiveRecord::Rollback
          end
        end

        if success
          render json: serialize_compensation(record.reload), status: :ok
        else
          render json: { errors: record.errors.full_messages }, status: :unprocessable_content
        end
      end
    end

    private

    def set_employee
      with_tenant_context do
        # First check if employee exists in current tenant
        emp = current_tenant.employees.find_by(id: params[:employee_id])
        return render_not_found unless emp

        # Check domain access for HR managers
        unless current_user.organization_admin? || accessible_domain_ids.include?(emp.domain_id)
          return render json: { error: "Forbidden: employee domain outside assigned scope" }, status: :forbidden
        end

        @employee = emp
      end
    end

    def compensation_params
      params.require(:compensation).permit(
        :effective_date,
        :currency,
        :pay_frequency,
        :status,
        :notes,
        components: [ :component_type, :amount, :percentage, :frequency ]
      )
    end

    def serialize_compensation(record)
      {
        id: record.id,
        effective_date: record.effective_date,
        currency: record.currency,
        pay_frequency: record.pay_frequency,
        status: record.status,
        notes: record.notes,
        base_salary_amount: record.base_salary_amount.to_s,
        total_annualized_compensation: record.total_annualized_compensation.to_s,
        created_by: record.created_by ? { id: record.created_by.id, email: record.created_by.email } : nil,
        approved_by: record.approved_by ? { id: record.approved_by.id, email: record.approved_by.email } : nil,
        components: record.compensation_components.map do |comp|
          {
            id: comp.id,
            component_type: comp.component_type,
            amount: comp.amount.to_s,
            percentage: comp.percentage&.to_s,
            frequency: comp.frequency,
            annualized_amount: comp.annualized_amount.to_s
          }
        end,
        created_at: record.created_at,
        updated_at: record.updated_at
      }
    end
  end
end
