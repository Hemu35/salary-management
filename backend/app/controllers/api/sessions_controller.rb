module Api
  class SessionsController < ApplicationController
    # POST /api/session
    def create
      email = params[:email].to_s.strip.downcase
      user = User.find_by(email: email)

      if user&.authenticate(params[:password]) && user.status == "active" && user.tenant.status == "active"
        reset_session # Prevent session fixation
        session[:user_id] = user.id
        render json: serialize_user(user), status: :ok
      else
        render json: { error: "Invalid email or password" }, status: :unauthorized
      end
    end

    # GET /api/session
    def show
      user = User.find_by(id: session[:user_id])
      if user && user.status == "active" && user.tenant.status == "active"
        render json: serialize_user(user), status: :ok
      else
        reset_session if session[:user_id]
        render json: { error: "Not authenticated" }, status: :unauthorized
      end
    end

    # DELETE /api/session
    def destroy
      reset_session
      render json: { message: "Logged out" }, status: :ok
    end

    private

    def serialize_user(user)
      domains_scope = user.organization_admin? ? user.tenant.domains.active : user.domains
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name
        },
        domains: domains_scope.order(:id).map do |d|
          { id: d.id, name: d.name }
        end
      }
    end
  end
end
