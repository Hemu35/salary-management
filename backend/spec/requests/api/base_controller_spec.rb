require "rails_helper"

# Dummy controller to test Api::BaseController behavior
class TestProtectedController < Api::BaseController
  before_action :require_admin!, only: [ :admin_only ]

  def index
    render json: {
      tenant_id: current_tenant.id,
      accessible_domains: accessible_domain_ids
    }
  end

  def admin_only
    render json: { message: "Welcome Admin" }
  end

  def rls_context_test
    with_tenant_context do
      result = ActiveRecord::Base.connection.select_value("SELECT current_setting('app.current_tenant_id', true)")
      render json: { pg_tenant_id: result }
    end
  end
end

RSpec.describe "Api::BaseController Security & Tenant Scoping", type: :request do
  before(:all) do
    Rails.application.routes.draw do
      get "/health/live",  to: "health#live"
      get "/health/ready", to: "health#ready"

      namespace :api do
        resource :session, only: [ :create, :show, :destroy ]
      end

      get "/test_protected", to: TestProtectedController.action(:index)
      get "/test_admin",     to: TestProtectedController.action(:admin_only)
      get "/test_rls",       to: TestProtectedController.action(:rls_context_test)
    end
  end

  after(:all) do
    Rails.application.reload_routes!
  end

  let!(:tenant) { create(:tenant, name: "Tenant Primary") }
  let!(:hr_user) { create(:user, :hr_manager, tenant: tenant) }
  let!(:admin_user) { create(:user, :admin, tenant: tenant) }

  describe "Authentication Guard (SEC-01)" do
    it "blocks unauthenticated requests with 401" do
      get "/test_protected"
      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)["error"]).to eq("Unauthorized")
    end

    it "blocks authenticated requests if tenant was suspended" do
      post "/api/session", params: { email: hr_user.email, password: "password123" }
      tenant.update!(status: "inactive")

      get "/test_protected"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "Role-Based Access Control (ROLE-01)" do
    it "forbids HR Managers from admin-only endpoints with 403 Forbidden" do
      post "/api/session", params: { email: hr_user.email, password: "password123" }
      get "/test_admin"
      expect(response).to have_http_status(:forbidden)
      expect(JSON.parse(response.body)["error"]).to eq("Forbidden")
    end

    it "allows Organization Admin to access admin-only endpoints" do
      post "/api/session", params: { email: admin_user.email, password: "password123" }
      get "/test_admin"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["message"]).to eq("Welcome Admin")
    end
  end

  describe "Tenant Context & PostgreSQL RLS setting (TEN-02, TEN-03)" do
    it "sets app.current_tenant_id in PostgreSQL session within with_tenant_context" do
      post "/api/session", params: { email: hr_user.email, password: "password123" }
      get "/test_rls"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["pg_tenant_id"]).to eq(tenant.id.to_s)
    end
  end
end
