require "rails_helper"
require "csv"

RSpec.describe ExportJobWorker, type: :worker do
  let(:tenant) { create(:tenant) }
  let(:domain_eng) { create(:domain, tenant: tenant, name: "Engineering") }
  let(:domain_sales) { create(:domain, tenant: tenant, name: "Sales") }

  let(:admin_user) { create(:user, :org_admin, tenant: tenant) }
  let(:hr_user) do
    u = create(:user, :hr_manager, tenant: tenant)
    create(:user_domain_assignment, tenant: tenant, user: u, domain: domain_eng)
    u
  end

  let!(:emp_eng) do
    create(:employee, tenant: tenant, domain: domain_eng, employee_number: "ENG01", first_name: "John", last_name: "Doe")
  end

  let!(:emp_sales) do
    create(:employee, tenant: tenant, domain: domain_sales, employee_number: "SALES01", first_name: "Jane", last_name: "Smith")
  end

  let!(:comp_eng) do
    comp = create(:compensation_record, tenant: tenant, employee: emp_eng, status: "active", currency: "USD", pay_frequency: "annual")
    create(:compensation_component, tenant: tenant, compensation_record: comp, component_type: "base_salary", amount: 120_000)
    create(:compensation_component, tenant: tenant, compensation_record: comp, component_type: "bonus", amount: 15_000)
    comp
  end

  after do
    FileUtils.rm_rf(Rails.root.join("storage", "exports"))
  end

  describe "#perform" do
    context "when executed by Organization Admin" do
      let(:export_job) do
        create(:export_job, tenant: tenant, user: admin_user, filename: "all_employees.csv", filters: {})
      end

      it "exports all employees across domains with compensation components" do
        described_class.new.perform(export_job.id)

        export_job.reload
        expect(export_job.status).to eq("completed")
        expect(export_job.total_rows).to eq(2)
        expect(export_job.processed_rows).to eq(2)
        expect(File.exist?(export_job.file_path)).to be true

        csv_rows = CSV.read(export_job.file_path, headers: true)
        expect(csv_rows.length).to eq(2)

        eng_row = csv_rows.find { |r| r["employee_number"] == "ENG01" }
        expect(eng_row).to be_present
        expect(eng_row["first_name"]).to eq("John")
        expect(eng_row["domain_name"]).to eq("Engineering")
        expect(eng_row["currency"]).to eq("USD")
        expect(eng_row["base_salary"]).to eq("120000.00")
        expect(eng_row["bonus"]).to eq("15000.00")
        expect(eng_row["total_annualized_compensation"]).to eq("135000.00")

        sales_row = csv_rows.find { |r| r["employee_number"] == "SALES01" }
        expect(sales_row).to be_present
        expect(sales_row["domain_name"]).to eq("Sales")
      end

      it "respects domain_id filter" do
        export_job.update!(filters: { "domain_id" => domain_eng.id.to_s })
        described_class.new.perform(export_job.id)

        export_job.reload
        expect(export_job.total_rows).to eq(1)

        csv_rows = CSV.read(export_job.file_path, headers: true)
        expect(csv_rows.length).to eq(1)
        expect(csv_rows.first["employee_number"]).to eq("ENG01")
      end

      it "respects search filter" do
        export_job.update!(filters: { "search" => "Smith" })
        described_class.new.perform(export_job.id)

        export_job.reload
        expect(export_job.total_rows).to eq(1)

        csv_rows = CSV.read(export_job.file_path, headers: true)
        expect(csv_rows.length).to eq(1)
        expect(csv_rows.first["employee_number"]).to eq("SALES01")
      end

      it "respects employee_ids filter for exporting only selected employees" do
        export_job.update!(filters: { "employee_ids" => [ emp_eng.id ] })
        described_class.new.perform(export_job.id)

        export_job.reload
        expect(export_job.total_rows).to eq(1)

        csv_rows = CSV.read(export_job.file_path, headers: true)
        expect(csv_rows.length).to eq(1)
        expect(csv_rows.first["employee_number"]).to eq("ENG01")
      end
    end

    context "when executed by HR Manager" do
      let(:export_job) do
        create(:export_job, tenant: tenant, user: hr_user, filename: "hr_export.csv", filters: {})
      end

      it "strictly restricts exported records to assigned domains" do
        described_class.new.perform(export_job.id)

        export_job.reload
        expect(export_job.status).to eq("completed")
        expect(export_job.total_rows).to eq(1)

        csv_rows = CSV.read(export_job.file_path, headers: true)
        expect(csv_rows.length).to eq(1)
        expect(csv_rows.first["employee_number"]).to eq("ENG01")
        expect(csv_rows.map { |r| r["employee_number"] }).not_to include("SALES01")
      end
    end
  end
end
