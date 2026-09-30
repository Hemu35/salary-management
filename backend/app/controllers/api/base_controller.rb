module Api
  class BaseController < ApplicationController
    before_action :authenticate!

    private

    def authenticate!
      unless current_user
        render json: { error: "Unauthorized" }, status: :unauthorized
      end
    end

    def current_user
      return @current_user if defined?(@current_user)
      user = User.find_by(id: session[:user_id])
      @current_user = (user && user.status == "active" && user.tenant.status == "active") ? user : nil
    end

    def current_tenant
      @current_tenant ||= current_user&.tenant
    end

    # Wraps block with transaction-local RLS tenant context.
    # MUST be used for every DB query on tenant-owned tables.
    def with_tenant_context(&block)
      ActiveRecord::Base.transaction do
        ActiveRecord::Base.connection.execute(
          ActiveRecord::Base.sanitize_sql(
            [ "SELECT set_config('app.current_tenant_id', ?, true)", current_tenant.id.to_s ]
          )
        )
        block.call
      end
    end

    def require_admin!
      unless current_user&.organization_admin?
        render json: { error: "Forbidden" }, status: :forbidden
      end
    end

    def accessible_domain_ids
      current_user.accessible_domain_ids
    end

    def render_not_found
      render json: { error: "Not found" }, status: :not_found
    end

    def render_unprocessable(resource)
      render json: { errors: resource.errors.full_messages }, status: :unprocessable_entity
    end
  end
end
