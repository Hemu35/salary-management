module Api
  class EmployeesController < BaseController
    before_action :set_employee, only: [ :show, :update ]

    # GET /api/employees
    def index
      with_tenant_context do
        scope = current_tenant.employees.includes(:domain)

        # Domain scoping
        if params[:domain_id].present?
          domain_id = params[:domain_id].to_i
          unless accessible_domain_ids.include?(domain_id)
            return render json: { error: "Forbidden: domain outside assigned scope" }, status: :forbidden
          end
          scope = scope.where(domain_id: domain_id)
        else
          unless current_user.organization_admin?
            scope = scope.where(domain_id: accessible_domain_ids)
          end
        end

        # Filters
        scope = scope.by_status(params[:employment_status])
        scope = scope.by_country(params[:country_code])
        scope = scope.search(params[:search])

        # Pagination via Kaminari
        page = [ params[:page].to_i, 1 ].max
        per_page = params[:per_page].present? ? [ params[:per_page].to_i, 100 ].min : 25
        paginated_employees = scope.order(created_at: :desc).page(page).per(per_page)

        render json: {
          employees: paginated_employees.map { |e| serialize_employee(e) },
          meta: {
            current_page: paginated_employees.current_page,
            total_pages: paginated_employees.total_pages,
            total_count: paginated_employees.total_count,
            per_page: per_page
          }
        }, status: :ok
      end
    end

    # GET /api/employees/:id
    def show
      render json: serialize_employee(@employee), status: :ok
    end

    # POST /api/employees
    def create
      with_tenant_context do
        if employee_params[:domain_id].present?
          domain_id = employee_params[:domain_id].to_i
          unless accessible_domain_ids.include?(domain_id)
            return render json: { error: "Forbidden: domain outside assigned scope" }, status: :forbidden
          end
        end

        employee = current_tenant.employees.build(employee_params)
        if employee.save
          render json: serialize_employee(employee), status: :created
        else
          render json: { errors: employee.errors.full_messages }, status: :unprocessable_entity
        end
      end
    end

    # PATCH /api/employees/:id
    def update
      with_tenant_context do
        if employee_params[:domain_id].present?
          new_domain_id = employee_params[:domain_id].to_i
          unless accessible_domain_ids.include?(new_domain_id)
            return render json: { error: "Forbidden: domain outside assigned scope" }, status: :forbidden
          end
        end

        if @employee.update(employee_params)
          render json: serialize_employee(@employee), status: :ok
        else
          render json: { errors: @employee.errors.full_messages }, status: :unprocessable_entity
        end
      end
    end

    private

    def set_employee
      with_tenant_context do
        scope = current_tenant.employees.includes(:domain)
        unless current_user.organization_admin?
          scope = scope.where(domain_id: accessible_domain_ids)
        end

        @employee = scope.find_by(id: params[:id])
        render_not_found unless @employee
      end
    end

    def employee_params
      params.require(:employee).permit(
        :domain_id,
        :employee_number,
        :first_name,
        :last_name,
        :email,
        :country_code,
        :job_title,
        :employment_status,
        :hire_date
      )
    end

    def serialize_employee(employee)
      {
        id: employee.id,
        employee_number: employee.employee_number,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        country_code: employee.country_code,
        job_title: employee.job_title,
        employment_status: employee.employment_status,
        hire_date: employee.hire_date,
        domain: {
          id: employee.domain.id,
          name: employee.domain.name
        },
        created_at: employee.created_at,
        updated_at: employee.updated_at
      }
    end
  end
end
