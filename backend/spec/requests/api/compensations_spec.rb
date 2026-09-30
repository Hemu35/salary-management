require "rails_helper"

RSpec.describe "Api::Compensations", type: :request do
  let!(:tenant) { create(:tenant) }
  let!(:domain_eng) { create(:domain, tenant: tenant, name: "Engineering") }
  let!(:domain_sales) { create(:domain, tenant: tenant, name: "Sales") }

  let!(:admin) { create(:user, :org_admin, tenant: tenant) }
  let!(:hr_eng) do
    user = create(:user, :hr_manager, tenant: tenant)
    create(:user_domain_assignment, tenant: tenant, user: user, domain: domain_eng)
    user
  end

  let!(:employee_eng) { create(:employee, tenant: tenant, domain: domain_eng) }
  let!(:employee_sales) { create(:employee, tenant: tenant, domain: domain_sales) }

  let!(:other_tenant) { create(:tenant) }
  let!(:other_employee) { create(:employee, tenant: other_tenant) }

  def login_as(user)
    post "/api/session", params: { email: user.email, password: "password123" }
    expect(response).to have_http_status(:ok)
  end

  describe "GET /api/employees/:employee_id/compensation" do
    context "when unauthenticated" do
      it "returns 401 Unauthorized" do
        get "/api/employees/#{employee_eng.id}/compensation"
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when employee belongs to another tenant" do
      before { login_as(admin) }

      it "returns 404 Not Found" do
        get "/api/employees/#{other_employee.id}/compensation"
        expect(response).to have_http_status(:not_found)
      end
    end

    context "when HR manager accesses employee in unauthorized domain" do
      before { login_as(hr_eng) }

      it "returns 403 Forbidden" do
        get "/api/employees/#{employee_sales.id}/compensation"
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when authorized" do
      let!(:record_old) do
        rec = create(:compensation_record,
          tenant: tenant,
          employee: employee_eng,
          effective_date: Date.current - 1.year,
          currency: "USD",
          pay_frequency: "annual",
          status: "superseded",
          created_by: admin
        )
        create(:compensation_component,
          tenant: tenant,
          compensation_record: rec,
          component_type: "base_salary",
          amount: BigDecimal("110000.00"),
          frequency: "annual"
        )
        rec
      end

      let!(:record_current) do
        rec = create(:compensation_record,
          tenant: tenant,
          employee: employee_eng,
          effective_date: Date.current,
          currency: "USD",
          pay_frequency: "annual",
          status: "active",
          created_by: hr_eng
        )
        create(:compensation_component,
          tenant: tenant,
          compensation_record: rec,
          component_type: "base_salary",
          amount: BigDecimal("130000.00"),
          frequency: "annual"
        )
        create(:compensation_component,
          tenant: tenant,
          compensation_record: rec,
          component_type: "bonus",
          amount: BigDecimal("15000.00"),
          frequency: "annual"
        )
        rec
      end

      it "returns compensation history ordered by effective_date desc with components and annualized sums" do
        login_as(hr_eng)
        get "/api/employees/#{employee_eng.id}/compensation"

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body["compensation_records"].length).to eq(2)

        first_record = body["compensation_records"].first
        expect(first_record["id"]).to eq(record_current.id)
        expect(first_record["status"]).to eq("active")
        expect(first_record["currency"]).to eq("USD")
        expect(first_record["base_salary_amount"]).to eq("130000.0")
        expect(first_record["total_annualized_compensation"]).to eq("145000.0")
        expect(first_record["components"].length).to eq(2)
        expect(first_record["created_by"]["email"]).to eq(hr_eng.email)

        second_record = body["compensation_records"].second
        expect(second_record["id"]).to eq(record_old.id)
        expect(second_record["status"]).to eq("superseded")
        expect(second_record["base_salary_amount"]).to eq("110000.0")
      end
    end
  end

  describe "POST /api/employees/:employee_id/compensation" do
    let(:valid_params) do
      {
        compensation: {
          effective_date: Date.current.to_s,
          currency: "USD",
          pay_frequency: "annual",
          status: "active",
          notes: "Annual compensation adjustment",
          components: [
            {
              component_type: "base_salary",
              amount: 140000.00,
              frequency: "annual"
            },
            {
              component_type: "bonus",
              amount: 20000.00,
              frequency: "annual"
            }
          ]
        }
      }
    end

    context "when unauthenticated" do
      it "returns 401 Unauthorized" do
        post "/api/employees/#{employee_eng.id}/compensation", params: valid_params
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when HR manager creates compensation for unauthorized domain" do
      before { login_as(hr_eng) }

      it "returns 403 Forbidden" do
        post "/api/employees/#{employee_sales.id}/compensation", params: valid_params
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when authorized" do
      before { login_as(hr_eng) }

      let!(:prior_record) do
        rec = create(:compensation_record,
          tenant: tenant,
          employee: employee_eng,
          effective_date: Date.current - 6.months,
          status: "active"
        )
        create(:compensation_component,
          tenant: tenant,
          compensation_record: rec,
          component_type: "base_salary",
          amount: BigDecimal("120000.00")
        )
        rec
      end

      it "creates compensation record with components and supersedes previous active record" do
        expect {
          post "/api/employees/#{employee_eng.id}/compensation", params: valid_params
        }.to change(CompensationRecord, :count).by(1)
         .and change(CompensationComponent, :count).by(2)

        expect(response).to have_http_status(:created)
        body = JSON.parse(response.body)

        expect(body["currency"]).to eq("USD")
        expect(body["status"]).to eq("active")
        expect(body["base_salary_amount"]).to eq("140000.0")
        expect(body["total_annualized_compensation"]).to eq("160000.0")
        expect(body["components"].length).to eq(2)
        expect(body["created_by"]["id"]).to eq(hr_eng.id)

        # Prior active record must now be superseded
        expect(prior_record.reload.status).to eq("superseded")
      end

      it "returns 422 Unprocessable Content on validation failure" do
        invalid_params = {
          compensation: {
            effective_date: nil,
            currency: "INVALID",
            pay_frequency: "invalid"
          }
        }

        post "/api/employees/#{employee_eng.id}/compensation", params: invalid_params
        expect(response).to have_http_status(:unprocessable_content)
        body = JSON.parse(response.body)
        expect(body["errors"]).to be_present
      end
    end
  end
end
