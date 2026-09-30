require "rails_helper"

RSpec.describe "Api::Sessions", type: :request do
  let!(:tenant) { create(:tenant, name: "Stark Industries") }
  let!(:user) { create(:user, tenant: tenant, email: "hr@example.com", password: "password123") }

  describe "POST /api/session (login)" do
    context "with valid credentials" do
      it "returns 200 and sanitized user profile without sensitive fields" do
        post "/api/session", params: { email: user.email, password: "password123" }
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["email"]).to eq("hr@example.com")
        expect(json["role"]).to eq("hr_manager")
        expect(json["tenant"]["id"]).to eq(tenant.id)
        expect(json["tenant"]["name"]).to eq("Stark Industries")
        expect(json).not_to have_key("password_digest")
        expect(json).not_to have_key("password")
      end

      it "sets session cookie" do
        post "/api/session", params: { email: user.email, password: "password123" }
        expect(session[:user_id]).to eq(user.id)
      end

      it "authenticates case-insensitively with leading and trailing whitespace" do
        post "/api/session", params: { email: "  HR@EXAMPLE.COM  ", password: "password123" }
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["email"]).to eq("hr@example.com")
      end

      it "prevents parameter tampering (attacker cannot inject tenant_id into session)" do
        other_tenant = create(:tenant, name: "Evil Corp")
        post "/api/session", params: {
          email: user.email,
          password: "password123",
          tenant_id: other_tenant.id
        }
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["tenant"]["id"]).to eq(tenant.id)
        expect(json["tenant"]["id"]).not_to eq(other_tenant.id)
      end
    end

    context "with invalid credentials or security attacks" do
      it "returns 401 for wrong password (SEC-01)" do
        post "/api/session", params: { email: user.email, password: "wrong_password" }
        expect(response).to have_http_status(:unauthorized)
        expect(JSON.parse(response.body)["error"]).to eq("Invalid email or password")
      end

      it "returns 401 for unknown email" do
        post "/api/session", params: { email: "nobody@example.com", password: "password123" }
        expect(response).to have_http_status(:unauthorized)
      end

      it "does not disclose whether user or tenant exists on failed login (SEC-01)" do
        post "/api/session", params: { email: "attacker@random.com", password: "password123" }
        body = response.body
        expect(body).not_to include("Stark Industries")
        expect(body).not_to include(tenant.id.to_s)
        expect(JSON.parse(body)["error"]).to eq("Invalid email or password")
      end

      it "safely rejects SQL injection attempts without 500 error" do
        post "/api/session", params: { email: "' OR '1'='1' --", password: "' OR '1'='1'" }
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when user is inactive" do
        user.update!(status: "inactive")
        post "/api/session", params: { email: user.email, password: "password123" }
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when tenant organization is inactive/suspended" do
        tenant.update!(status: "inactive")
        post "/api/session", params: { email: user.email, password: "password123" }
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "GET /api/session" do
    it "returns current user when logged in" do
      post "/api/session", params: { email: user.email, password: "password123" }
      get "/api/session"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["id"]).to eq(user.id)
    end

    it "returns 401 when not logged in (SEC-01)" do
      get "/api/session"
      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)["error"]).to eq("Not authenticated")
    end

    it "handles stale session gracefully if user was deleted" do
      post "/api/session", params: { email: user.email, password: "password123" }
      user.destroy
      get "/api/session"
      expect(response).to have_http_status(:unauthorized)
    end

    it "invalidates session if tenant was suspended after login" do
      post "/api/session", params: { email: user.email, password: "password123" }
      tenant.update!(status: "inactive")
      get "/api/session"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/session (logout)" do
    it "clears session and returns 200" do
      post "/api/session", params: { email: user.email, password: "password123" }
      expect(session[:user_id]).to eq(user.id)

      delete "/api/session"
      expect(response).to have_http_status(:ok)
      expect(session[:user_id]).to be_nil

      get "/api/session"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
