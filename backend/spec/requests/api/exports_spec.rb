require "rails_helper"

RSpec.describe "Api::Exports", type: :request do
  let(:tenant) { create(:tenant) }
  let(:domain_eng) { create(:domain, tenant: tenant, name: "Engineering") }
  let(:domain_sales) { create(:domain, tenant: tenant, name: "Sales") }

  let(:admin_user) { create(:user, :org_admin, tenant: tenant) }
  let(:hr_user) do
    u = create(:user, :hr_manager, tenant: tenant)
    create(:user_domain_assignment, tenant: tenant, user: u, domain: domain_eng)
    u
  end

  let(:other_tenant) { create(:tenant) }
  let(:other_user) { create(:user, tenant: other_tenant) }

  def login_as(target_user)
    post "/api/session", params: { email: target_user.email, password: "password123" }
    expect(response).to have_http_status(:ok)
  end

  describe "POST /api/exports" do
    context "when unauthenticated" do
      it "returns 401 Unauthorized" do
        post "/api/exports", params: {}
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when authenticated as Org Admin" do
      before { login_as(admin_user) }

      it "creates an ExportJob and enqueues worker" do
        expect(ExportJobWorker).to receive(:perform_async).with(kind_of(Integer))

        post "/api/exports", params: { domain_id: "all", employment_status: "active" }
        expect(response).to have_http_status(:accepted)

        json = JSON.parse(response.body)
        expect(json["status"]).to eq("queued")
        expect(json["filename"]).to match(/employees_export_\d+_\d+\.csv/)
        expect(json["filters"]["employment_status"]).to eq("active")
      end

      it "creates an ExportJob with employee_ids filter and custom filename" do
        expect(ExportJobWorker).to receive(:perform_async)

        post "/api/exports", params: { employee_ids: [ 101, 102 ] }
        expect(response).to have_http_status(:accepted)

        json = JSON.parse(response.body)
        expect(json["filename"]).to match(/employees_export_selected_2_\d+_\d+\.csv/)
        expect(json["filters"]["employee_ids"]).to eq([ 101, 102 ])
      end
    end

    context "when authenticated as HR Manager" do
      before { login_as(hr_user) }

      it "allows export within assigned domain" do
        expect(ExportJobWorker).to receive(:perform_async)

        post "/api/exports", params: { domain_id: domain_eng.id }
        expect(response).to have_http_status(:accepted)
      end

      it "returns 403 Forbidden when attempting to export unassigned domain" do
        post "/api/exports", params: { domain_id: domain_sales.id }
        expect(response).to have_http_status(:forbidden)
        expect(JSON.parse(response.body)["error"]).to match(/not authorized/i)
      end
    end
  end

  describe "GET /api/exports" do
    let!(:job1) { create(:export_job, tenant: tenant, user: admin_user) }
    let!(:job2) { create(:export_job, tenant: other_tenant, user: other_user) }

    it "lists export jobs scoped strictly to current tenant" do
      login_as(admin_user)
      get "/api/exports"
      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      job_ids = json["export_jobs"].map { |j| j["id"] }
      expect(job_ids).to include(job1.id)
      expect(job_ids).not_to include(job2.id)
    end
  end

  describe "GET /api/exports/:id" do
    let(:job) { create(:export_job, tenant: tenant, user: admin_user) }

    it "returns the export job details" do
      login_as(admin_user)
      get "/api/exports/#{job.id}"
      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json["id"]).to eq(job.id)
      expect(json["filename"]).to eq(job.filename)
    end

    it "returns 404 for export job belonging to another tenant" do
      other_job = create(:export_job, tenant: other_tenant, user: other_user)
      login_as(admin_user)

      get "/api/exports/#{other_job.id}"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/exports/:id/download" do
    let(:temp_csv) do
      file = Tempfile.new([ "export_test", ".csv" ])
      file.write("employee_number,first_name\nEMP01,John\n")
      file.flush
      file
    end

    after { temp_csv.close! }

    context "when export is completed and file exists" do
      let(:completed_job) do
        create(:export_job, :completed,
               tenant: tenant,
               user: admin_user,
               file_path: temp_csv.path,
               filename: "downloadable.csv")
      end

      it "streams the CSV file with attachment headers" do
        login_as(admin_user)
        get "/api/exports/#{completed_job.id}/download"

        expect(response).to have_http_status(:ok)
        expect(response.headers["Content-Type"]).to match(/text\/csv/)
        expect(response.headers["Content-Disposition"]).to include('attachment; filename="downloadable.csv"')
        expect(response.body).to include("EMP01,John")
      end
    end

    context "when export is not yet completed" do
      let(:queued_job) { create(:export_job, tenant: tenant, user: admin_user, status: "queued") }

      it "returns 400 Bad Request" do
        login_as(admin_user)
        get "/api/exports/#{queued_job.id}/download"
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "when export is expired" do
      let(:expired_job) do
        create(:export_job, :completed,
               tenant: tenant,
               user: admin_user,
               file_path: temp_csv.path,
               expires_at: 1.hour.ago)
      end

      it "returns 410 Gone" do
        login_as(admin_user)
        get "/api/exports/#{expired_job.id}/download"
        expect(response).to have_http_status(:gone)
      end
    end
  end
end
