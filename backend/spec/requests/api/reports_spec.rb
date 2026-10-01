require "rails_helper"

RSpec.describe "Api::Reports", type: :request do
  let!(:tenant_a) { create(:tenant, name: "Acme Corp") }
  let!(:tenant_b) { create(:tenant, name: "Stark Industries") }

  let!(:domain_a1) { create(:domain, tenant: tenant_a, name: "Engineering") }
  let!(:domain_a2) { create(:domain, tenant: tenant_a, name: "Sales & Marketing") }
  let!(:domain_b) { create(:domain, tenant: tenant_b, name: "Defense") }

  let!(:org_admin) { create(:user, :admin, tenant: tenant_a, email: "admin@acme.com", password: "password123") }
  let!(:hr_manager) { create(:user, :hr_manager, tenant: tenant_a, email: "hr@acme.com", password: "password123") }
  let!(:stark_admin) { create(:user, :admin, tenant: tenant_b, email: "admin@stark.com", password: "password123") }

  # Tenant A - Engineering employees
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
      domain: domain_a1,
      employee_number: "EMP002",
      first_name: "Bob",
      last_name: "Taylor",
      email: "bob@acme.com",
      country_code: "US",
      employment_status: "active"
    )
  end

  # Tenant A - Sales employee (UK, on leave)
  let!(:emp_a3) do
    create(:employee,
      tenant: tenant_a,
      domain: domain_a2,
      employee_number: "EMP003",
      first_name: "Carol",
      last_name: "Danvers",
      email: "carol@acme.com",
      country_code: "GB",
      employment_status: "on_leave"
    )
  end

  # Tenant B - employee
  let!(:emp_b) do
    create(:employee,
      tenant: tenant_b,
      domain: domain_b,
      employee_number: "EMP999",
      first_name: "Tony",
      last_name: "Stark",
      email: "tony@stark.com",
      country_code: "US",
      employment_status: "active"
    )
  end

  # Compensation records for Tenant A
  # Alice: USD 120k base + 10k bonus = 130k
  let!(:comp_a1) do
    rec = create(:compensation_record,
      tenant: tenant_a,
      employee: emp_a1,
      currency: "USD",
      pay_frequency: "annual",
      status: "active",
      effective_date: "2024-01-01"
    )
    create(:compensation_component,
      tenant: tenant_a,
      compensation_record: rec,
      component_type: "base_salary",
      amount: 120_000,
      frequency: "annual"
    )
    create(:compensation_component,
      tenant: tenant_a,
      compensation_record: rec,
      component_type: "bonus",
      amount: 10_000,
      frequency: "annual"
    )
    rec
  end

  # Bob: USD 100k base = 100k
  let!(:comp_a2) do
    rec = create(:compensation_record,
      tenant: tenant_a,
      employee: emp_a2,
      currency: "USD",
      pay_frequency: "annual",
      status: "active",
      effective_date: "2024-01-01"
    )
    create(:compensation_component,
      tenant: tenant_a,
      compensation_record: rec,
      component_type: "base_salary",
      amount: 100_000,
      frequency: "annual"
    )
    rec
  end

  # Carol: GBP 80k base = 80k
  let!(:comp_a3) do
    rec = create(:compensation_record,
      tenant: tenant_a,
      employee: emp_a3,
      currency: "GBP",
      pay_frequency: "annual",
      status: "active",
      effective_date: "2024-01-01"
    )
    create(:compensation_component,
      tenant: tenant_a,
      compensation_record: rec,
      component_type: "base_salary",
      amount: 80_000,
      frequency: "annual"
    )
    rec
  end

  # Tenant B compensation - EUR 150k
  let!(:comp_b) do
    rec = create(:compensation_record,
      tenant: tenant_b,
      employee: emp_b,
      currency: "EUR",
      pay_frequency: "annual",
      status: "active",
      effective_date: "2024-01-01"
    )
    create(:compensation_component,
      tenant: tenant_b,
      compensation_record: rec,
      component_type: "base_salary",
      amount: 150_000,
      frequency: "annual"
    )
    rec
  end

  before do
    # HR Manager assigned only to Engineering (domain_a1)
    create(:user_domain_assignment, tenant: tenant_a, user: hr_manager, domain: domain_a1)
  end

  def login_as(user)
    post "/api/session", params: { email: user.email, password: "password123" }
    expect(response).to have_http_status(:ok)
  end

  describe "GET /api/reports/workforce" do
    it "returns 401 Unauthorized when unauthenticated" do
      get "/api/reports/workforce"
      expect(response).to have_http_status(:unauthorized)
    end

    context "when logged in as Organization Admin" do
      before { login_as(org_admin) }

      it "returns organization-wide workforce metrics across all domains" do
        get "/api/reports/workforce"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["total_headcount"]).to eq(3)
        expect(json["active_headcount"]).to eq(2)
        expect(json["on_leave_headcount"]).to eq(1)
        expect(json["terminated_headcount"]).to eq(0)

        # By country
        countries = json["by_country"]
        expect(countries.size).to eq(2)
        us_stat = countries.find { |c| c["country_code"] == "US" }
        expect(us_stat["count"]).to eq(2)
        expect(us_stat["percentage"]).to eq(66.7)

        gb_stat = countries.find { |c| c["country_code"] == "GB" }
        expect(gb_stat["count"]).to eq(1)
        expect(gb_stat["percentage"]).to eq(33.3)

        # By domain
        domains = json["by_domain"]
        expect(domains.size).to eq(2)
        eng_stat = domains.find { |d| d["domain_name"] == "Engineering" }
        expect(eng_stat["count"]).to eq(2)

        sales_stat = domains.find { |d| d["domain_name"] == "Sales & Marketing" }
        expect(sales_stat["count"]).to eq(1)

        # Never includes Tenant B employees
        expect(json["total_headcount"]).not_to eq(4)
      end

      it "filters workforce report by domain_id" do
        get "/api/reports/workforce", params: { domain_id: domain_a1.id }

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["total_headcount"]).to eq(2)
        expect(json["by_domain"].first["domain_name"]).to eq("Engineering")
      end
    end

    context "when logged in as HR Manager" do
      before { login_as(hr_manager) }

      it "restricts workforce report to assigned domain(s)" do
        get "/api/reports/workforce"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        # Only Engineering employees (Alice and Bob)
        expect(json["total_headcount"]).to eq(2)
        expect(json["by_domain"].size).to eq(1)
        expect(json["by_domain"].first["domain_name"]).to eq("Engineering")

        # Carol (Sales) is NOT included
        domains_present = json["by_domain"].map { |d| d["domain_name"] }
        expect(domains_present).not_to include("Sales & Marketing")
      end

      it "returns 403 Forbidden when requesting a domain outside assigned scope" do
        get "/api/reports/workforce", params: { domain_id: domain_a2.id }
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "Tenant isolation" do
      it "ensures Tenant A and Tenant B never see each other's workforce data" do
        login_as(stark_admin)
        get "/api/reports/workforce"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["total_headcount"]).to eq(1)
        expect(json["by_domain"].first["domain_name"]).to eq("Defense")
      end
    end
  end

  describe "GET /api/reports/compensation" do
    it "returns 401 Unauthorized when unauthenticated" do
      get "/api/reports/compensation"
      expect(response).to have_http_status(:unauthorized)
    end

    context "when logged in as Organization Admin" do
      before { login_as(org_admin) }

      it "groups compensation strictly by currency with zero cross-currency mixing" do
        get "/api/reports/compensation"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        currencies = json["currencies"]
        currency_codes = currencies.map { |c| c["currency"] }

        # Should contain USD and GBP, but NOT EUR (Tenant B)
        expect(currency_codes).to contain_exactly("GBP", "USD")

        # USD group (Alice 130k + Bob 100k = 230k)
        usd = currencies.find { |c| c["currency"] == "USD" }
        expect(usd["employee_count"]).to eq(2)
        expect(usd["total_annualized_budget"]).to eq(230_000.0)
        expect(usd["avg_annualized_compensation"]).to eq(115_000.0)
        expect(usd["min_annualized_compensation"]).to eq(100_000.0)
        expect(usd["max_annualized_compensation"]).to eq(130_000.0)
        expect(usd["median_annualized_compensation"]).to eq(115_000.0)

        # USD Component breakdown: 220k base + 10k bonus
        expect(usd["component_breakdown"]["base_salary"]).to eq(220_000.0)
        expect(usd["component_breakdown"]["bonus"]).to eq(10_000.0)
        expect(usd["component_breakdown"]["allowance"]).to eq(0.0)

        # GBP group (Carol 80k)
        gbp = currencies.find { |c| c["currency"] == "GBP" }
        expect(gbp["employee_count"]).to eq(1)
        expect(gbp["total_annualized_budget"]).to eq(80_000.0)
        expect(gbp["avg_annualized_compensation"]).to eq(80_000.0)
        expect(gbp["component_breakdown"]["base_salary"]).to eq(80_000.0)
      end

      it "filters compensation report by domain_id" do
        get "/api/reports/compensation", params: { domain_id: domain_a1.id }

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        currencies = json["currencies"]
        # In domain_a1 (Engineering), only USD employees exist
        expect(currencies.map { |c| c["currency"] }).to eq(["USD"])
        expect(currencies.first["employee_count"]).to eq(2)
      end
    end

    context "when logged in as HR Manager" do
      before { login_as(hr_manager) }

      it "restricts compensation report to assigned domain(s)" do
        get "/api/reports/compensation"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        currencies = json["currencies"]
        # HR Manager only has domain_a1 (USD), so GBP (Carol in domain_a2) is not returned
        expect(currencies.map { |c| c["currency"] }).to eq(["USD"])
        expect(currencies.first["total_annualized_budget"]).to eq(230_000.0)
      end

      it "returns 403 Forbidden when requesting an unassigned domain" do
        get "/api/reports/compensation", params: { domain_id: domain_a2.id }
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "Tenant isolation" do
      it "ensures Tenant A and Tenant B never see each other's compensation budgets" do
        login_as(stark_admin)
        get "/api/reports/compensation"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        currencies = json["currencies"]
        expect(currencies.map { |c| c["currency"] }).to eq(["EUR"])
        expect(currencies.first["total_annualized_budget"]).to eq(150_000.0)
      end
    end
  end
end
