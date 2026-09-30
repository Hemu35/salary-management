require "rails_helper"

RSpec.describe "Api::Employees", type: :request do
  let!(:tenant_a) { create(:tenant, name: "Acme Corp") }
  let!(:tenant_b) { create(:tenant, name: "Stark Industries") }

  let!(:domain_a1) { create(:domain, tenant: tenant_a, name: "Engineering") }
  let!(:domain_a2) { create(:domain, tenant: tenant_a, name: "Marketing") }
  let!(:domain_b) { create(:domain, tenant: tenant_b, name: "Defense") }

  let!(:org_admin) { create(:user, :admin, tenant: tenant_a, email: "admin@acme.com", password: "password123") }
  let!(:hr_manager) { create(:user, :hr_manager, tenant: tenant_a, email: "hr@acme.com", password: "password123") }

  let!(:emp_a1) do
    create(:employee,
      tenant: tenant_a,
      domain: domain_a1,
      employee_number: "EMP001",
      first_name: "Alice",
      last_name: "Smith",
      email: "alice@acme.com",
      country_code: "US",
      employment_status: "active"
    )
  end

  let!(:emp_a2) do
    create(:employee,
      tenant: tenant_a,
      domain: domain_a2,
      employee_number: "EMP002",
      first_name: "Bob",
      last_name: "Miller",
      email: "bob@acme.com",
      country_code: "GB",
      employment_status: "terminated"
    )
  end

  let!(:emp_b) do
    create(:employee,
      tenant: tenant_b,
      domain: domain_b,
      employee_number: "EMP099",
      first_name: "Charlie",
      last_name: "Brown",
      email: "charlie@stark.com"
    )
  end

  before do
    # Assign HR Manager only to Engineering (domain_a1)
    create(:user_domain_assignment, tenant: tenant_a, user: hr_manager, domain: domain_a1)
  end

  def login_as(user)
    post "/api/session", params: { email: user.email, password: "password123" }
    expect(response).to have_http_status(:ok)
  end

  describe "GET /api/employees" do
    context "when unauthenticated" do
      it "returns 401 Unauthorized" do
        get "/api/employees"
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when logged in as Organization Admin" do
      before { login_as(org_admin) }

      it "lists all employees in the tenant with pagination metadata" do
        get "/api/employees"
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["employees"].map { |e| e["id"] }).to contain_exactly(emp_a1.id, emp_a2.id)
        expect(json["employees"].map { |e| e["id"] }).not_to include(emp_b.id)

        meta = json["meta"]
        expect(meta["current_page"]).to eq(1)
        expect(meta["total_count"]).to eq(2)
        expect(meta["per_page"]).to eq(25)
      end

      it "filters by domain_id" do
        get "/api/employees", params: { domain_id: domain_a1.id }
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["employees"].map { |e| e["id"] }).to contain_exactly(emp_a1.id)
      end

      it "filters by employment_status" do
        get "/api/employees", params: { employment_status: "terminated" }
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["employees"].map { |e| e["id"] }).to contain_exactly(emp_a2.id)
      end

      it "filters by country_code" do
        get "/api/employees", params: { country_code: "US" }
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["employees"].map { |e| e["id"] }).to contain_exactly(emp_a1.id)
      end

      it "searches by query string case-insensitively" do
        get "/api/employees", params: { search: "alice" }
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["employees"].map { |e| e["id"] }).to contain_exactly(emp_a1.id)
      end

      it "paginates results" do
        get "/api/employees", params: { per_page: 1, page: 1 }
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["employees"].length).to eq(1)
        expect(json["meta"]["total_pages"]).to eq(2)
      end
    end

    context "when logged in as HR Manager (domain scoped)" do
      before { login_as(hr_manager) }

      it "only returns employees in assigned domains" do
        get "/api/employees"
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["employees"].map { |e| e["id"] }).to contain_exactly(emp_a1.id)
        expect(json["employees"].map { |e| e["id"] }).not_to include(emp_a2.id)
        expect(json["employees"].map { |e| e["id"] }).not_to include(emp_b.id)
      end

      it "returns 403 Forbidden when requesting a domain outside assigned scope" do
        get "/api/employees", params: { domain_id: domain_a2.id }
        expect(response).to have_http_status(:forbidden)
        expect(JSON.parse(response.body)["error"]).to match(/domain outside assigned scope/i)
      end
    end
  end

  describe "GET /api/employees/:id" do
    context "when logged in as Organization Admin" do
      before { login_as(org_admin) }

      it "returns employee details for tenant employees" do
        get "/api/employees/#{emp_a1.id}"
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["id"]).to eq(emp_a1.id)
        expect(json["first_name"]).to eq("Alice")
        expect(json["domain"]["id"]).to eq(domain_a1.id)
      end

      it "returns 404 for employee belonging to another tenant (TEN-01)" do
        get "/api/employees/#{emp_b.id}"
        expect(response).to have_http_status(:not_found)
      end
    end

    context "when logged in as HR Manager" do
      before { login_as(hr_manager) }

      it "returns employee in assigned domain" do
        get "/api/employees/#{emp_a1.id}"
        expect(response).to have_http_status(:ok)
      end

      it "returns 404 for employee in unassigned domain of same tenant" do
        get "/api/employees/#{emp_a2.id}"
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "POST /api/employees" do
    let(:valid_params) do
      {
        employee: {
          domain_id: domain_a1.id,
          employee_number: "EMP999",
          first_name: "Diana",
          last_name: "Prince",
          email: "diana@acme.com",
          country_code: "US",
          job_title: "Security Engineer",
          employment_status: "active",
          hire_date: "2026-01-15"
        }
      }
    end

    context "when logged in as Organization Admin" do
      before { login_as(org_admin) }

      it "creates employee in any tenant domain" do
        expect {
          post "/api/employees", params: valid_params
        }.to change(Employee, :count).by(1)

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json["email"]).to eq("diana@acme.com")
        expect(json["domain"]["id"]).to eq(domain_a1.id)
      end

      it "prevents parameter tampering (cannot inject tenant_id of other tenant)" do
        tampered_params = valid_params.deep_merge(employee: { tenant_id: tenant_b.id })
        post "/api/employees", params: tampered_params
        expect(response).to have_http_status(:created)
        created_employee = Employee.find(JSON.parse(response.body)["id"])
        expect(created_employee.tenant_id).to eq(tenant_a.id)
        expect(created_employee.tenant_id).not_to eq(tenant_b.id)
      end

      it "returns 422 Unprocessable Entity when validation fails" do
        post "/api/employees", params: { employee: { first_name: "" } }
        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["errors"]).to be_present
      end
    end

    context "when logged in as HR Manager" do
      before { login_as(hr_manager) }

      it "creates employee in assigned domain" do
        post "/api/employees", params: valid_params
        expect(response).to have_http_status(:created)
      end

      it "returns 403 Forbidden when trying to create employee in unassigned domain" do
        unassigned_params = valid_params.deep_merge(employee: { domain_id: domain_a2.id })
        post "/api/employees", params: unassigned_params
        expect(response).to have_http_status(:forbidden)
        expect(JSON.parse(response.body)["error"]).to match(/domain outside assigned scope/i)
      end
    end
  end

  describe "PATCH /api/employees/:id" do
    before { login_as(org_admin) }

    it "updates employee attributes successfully" do
      patch "/api/employees/#{emp_a1.id}", params: { employee: { job_title: "Staff Engineer" } }
      expect(response).to have_http_status(:ok)
      expect(emp_a1.reload.job_title).to eq("Staff Engineer")
    end

    it "returns 422 on invalid update" do
      patch "/api/employees/#{emp_a1.id}", params: { employee: { email: "invalid-email" } }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
