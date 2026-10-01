require "rails_helper"

RSpec.describe ImportJob, type: :model do
  let(:tenant) { create(:tenant) }
  let(:user) { create(:user, tenant: tenant) }

  subject { build(:import_job, tenant: tenant, user: user) }

  describe "associations" do
    it { should belong_to(:tenant) }
    it { should belong_to(:user) }
  end

  describe "validations" do
    it { should validate_presence_of(:filename) }
    it { should validate_presence_of(:file_path) }
    it { should validate_inclusion_of(:status).in_array(ImportJob::STATUSES) }
  end

  describe "#progress_percentage" do
    it "returns 0 when total_rows is 0" do
      job = build(:import_job, total_rows: 0, processed_rows: 0)
      expect(job.progress_percentage).to eq(0)
    end

    it "returns rounded percentage during processing" do
      job = build(:import_job, status: "processing", total_rows: 100, processed_rows: 45)
      expect(job.progress_percentage).to eq(45)
    end

    it "returns 100 when status is completed" do
      job = build(:import_job, status: "completed", total_rows: 50, processed_rows: 50)
      expect(job.progress_percentage).to eq(100)
    end

    it "returns 100 when status is failed" do
      job = build(:import_job, status: "failed", total_rows: 50, processed_rows: 10)
      expect(job.progress_percentage).to eq(100)
    end
  end

  describe "Row-Level Security (RLS)", truncation: true do
    let(:tenant_a) { create(:tenant, name: "Tenant A") }
    let(:tenant_b) { create(:tenant, name: "Tenant B") }
    let(:user_a) { create(:user, tenant: tenant_a) }
    let(:user_b) { create(:user, tenant: tenant_b) }
    let!(:job_a) { create(:import_job, tenant: tenant_a, user: user_a) }
    let!(:job_b) { create(:import_job, tenant: tenant_b, user: user_b) }

    def execute_as_tenant(target_tenant, &block)
      ActiveRecord::Base.transaction do
        ActiveRecord::Base.connection.execute("SET LOCAL ROLE app_user")
        ActiveRecord::Base.connection.execute(
          ActiveRecord::Base.sanitize_sql([ "SELECT set_config('app.current_tenant_id', ?, true)", target_tenant.id.to_s ])
        )
        block.call
      ensure
        ActiveRecord::Base.connection.execute("RESET ROLE") rescue nil
      end
    end

    it "prevents selecting import jobs from other tenants under RLS" do
      execute_as_tenant(tenant_a) do
        expect(ImportJob.pluck(:id)).to contain_exactly(job_a.id)
        expect(ImportJob.pluck(:id)).not_to include(job_b.id)
      end
    end
  end
end
