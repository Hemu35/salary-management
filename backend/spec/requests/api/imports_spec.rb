require "rails_helper"

RSpec.describe "Api::Imports", type: :request do
  let(:tenant) { create(:tenant) }
  let(:domain) { create(:domain, tenant: tenant, name: "Engineering") }
  let(:user) do
    u = create(:user, :hr_manager, tenant: tenant)
    create(:user_domain_assignment, tenant: tenant, user: u, domain: domain)
    u
  end

  let(:other_tenant) { create(:tenant) }
  let(:other_user) { create(:user, tenant: other_tenant) }

  def login_as(target_user)
    post "/api/session", params: { email: target_user.email, password: "password123" }
    expect(response).to have_http_status(:ok)
  end

  describe "POST /api/imports" do
    let(:csv_path) { Rails.root.join("spec", "fixtures", "files", "employees.csv") }
    let(:valid_csv) { Rack::Test::UploadedFile.new(csv_path, "text/csv") }

    before do
      FileUtils.mkdir_p(Rails.root.join("spec", "fixtures", "files"))
      File.write(
        Rails.root.join("spec", "fixtures", "files", "employees.csv"),
        "employee_number,first_name,last_name,email,domain_name,country_code,job_title\nEMP1,A,B,a@b.com,Engineering,US,Dev\n"
      )
    end

    context "when unauthenticated" do
      it "returns 401 Unauthorized" do
        post "/api/imports", params: { file: valid_csv }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when authenticated" do
      before { login_as(user) }

      it "returns 422 if file is missing" do
        post "/api/imports", params: {}
        expect(response).to have_http_status(:unprocessable_content)
        expect(JSON.parse(response.body)["error"]).to match(/no csv file provided/i)
      end

      it "returns 422 if file is not a CSV" do
        txt_path = Rails.root.join("spec", "fixtures", "files", "sample.txt")
        File.write(txt_path, "hello")
        txt_file = Rack::Test::UploadedFile.new(txt_path, "text/plain")

        post "/api/imports", params: { file: txt_file }
        expect(response).to have_http_status(:unprocessable_content)
        expect(JSON.parse(response.body)["error"]).to match(/must be a csv/i)
      end

      it "creates an ImportJob, enqueues worker, and returns 202 Accepted" do
        expect(ImportJobWorker).to receive(:perform_async).with(kind_of(Integer))

        expect {
          post "/api/imports", params: { file: valid_csv }
        }.to change(ImportJob, :count).by(1)

        expect(response).to have_http_status(:accepted)
        body = JSON.parse(response.body)
        expect(body["status"]).to eq("queued")
        expect(body["filename"]).to eq("employees.csv")
        expect(body["progress_percentage"]).to eq(0)
      end
    end
  end

  describe "GET /api/imports/:id" do
    let!(:job) { create(:import_job, tenant: tenant, user: user, filename: "test.csv") }
    let!(:other_job) { create(:import_job, tenant: other_tenant, user: other_user) }

    context "when unauthenticated" do
      it "returns 401 Unauthorized" do
        get "/api/imports/#{job.id}"
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when authenticated" do
      before { login_as(user) }

      it "returns job details and progress" do
        get "/api/imports/#{job.id}"
        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body["id"]).to eq(job.id)
        expect(body["filename"]).to eq("test.csv")
        expect(body["status"]).to eq("queued")
      end

      it "returns 404 for a job belonging to another tenant" do
        get "/api/imports/#{other_job.id}"
        expect(response).to have_http_status(:not_found)
      end

      it "returns 404 for non-existent job" do
        get "/api/imports/999999"
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "POST /api/imports/:id/cancel" do
    let!(:queued_job) { create(:import_job, tenant: tenant, user: user, status: "queued") }
    let!(:other_job) { create(:import_job, tenant: other_tenant, user: other_user, status: "queued") }

    context "when authenticated" do
      before { login_as(user) }

      it "cancels a queued job immediately" do
        post "/api/imports/#{queued_job.id}/cancel"
        expect(response).to have_http_status(:ok)
        expect(queued_job.reload.status).to eq("cancelled")
      end

      it "returns 404 for a job belonging to another tenant" do
        post "/api/imports/#{other_job.id}/cancel"
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "POST /api/imports/:id/rollback" do
    let!(:emp) { create(:employee, tenant: tenant, domain: domain, employee_number: "ROLLBACK_TEST") }
    let!(:completed_job) do
      create(:import_job,
        tenant: tenant,
        user: user,
        status: "completed",
        rollback_metadata: { "created_employee_ids" => [ emp.id ] }
      )
    end

    context "when authenticated" do
      before { login_as(user) }

      it "rolls back a completed job and reverts created records" do
        post "/api/imports/#{completed_job.id}/rollback"
        expect(response).to have_http_status(:ok)
        expect(completed_job.reload.status).to eq("rolled_back")
        expect(tenant.employees.find_by(id: emp.id)).to be_nil
      end

      it "returns 422 if job cannot be rolled back" do
        empty_job = create(:import_job, tenant: tenant, user: user, status: "queued")
        post "/api/imports/#{empty_job.id}/rollback"
        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end
end
