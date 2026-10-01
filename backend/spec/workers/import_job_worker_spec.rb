require "rails_helper"

RSpec.describe ImportJobWorker, type: :worker do
  let(:tenant) { create(:tenant) }
  let!(:domain_eng) { create(:domain, tenant: tenant, name: "Engineering") }
  let!(:domain_sales) { create(:domain, tenant: tenant, name: "Sales") }

  let(:admin) { create(:user, :admin, tenant: tenant) }
  let(:hr_eng) do
    user = create(:user, :hr_manager, tenant: tenant)
    create(:user_domain_assignment, tenant: tenant, user: user, domain: domain_eng)
    user
  end

  let(:csv_dir) { Rails.root.join("tmp", "test_imports") }

  before do
    FileUtils.mkdir_p(csv_dir)
  end

  after do
    FileUtils.rm_rf(csv_dir)
  end

  def create_csv_file(filename, rows)
    path = csv_dir.join(filename)
    CSV.open(path, "w", write_headers: true, headers: rows.first.keys) do |csv|
      rows.each { |r| csv << r.values }
    end
    path.to_s
  end

  describe "#perform" do
    context "when import file contains valid employee and compensation rows" do
      let(:csv_rows) do
        [
          {
            "employee_number" => "IMP0001",
            "first_name" => "John",
            "last_name" => "Doe",
            "email" => "john.doe@example.com",
            "domain_name" => "Engineering",
            "country_code" => "US",
            "job_title" => "Software Engineer",
            "employment_status" => "active",
            "hire_date" => "2024-01-15",
            "currency" => "USD",
            "pay_frequency" => "annual",
            "effective_date" => "2024-01-15",
            "base_salary" => "130000.00",
            "bonus" => "10000.00"
          },
          {
            "employee_number" => "IMP0002",
            "first_name" => "Jane",
            "last_name" => "Smith",
            "email" => "jane.smith@example.com",
            "domain_name" => "Engineering",
            "country_code" => "GB",
            "job_title" => "QA Lead",
            "employment_status" => "active",
            "hire_date" => "2024-02-01",
            "currency" => "GBP",
            "pay_frequency" => "annual",
            "effective_date" => "2024-02-01",
            "base_salary" => "85000.00",
            "bonus" => "5000.00"
          }
        ]
      end

      let(:file_path) { create_csv_file("valid.csv", csv_rows) }
      let(:job) { create(:import_job, tenant: tenant, user: hr_eng, file_path: file_path) }

      it "processes all rows, creates employees and compensation records, and marks status completed" do
        expect {
          described_class.new.perform(job.id)
        }.to change(Employee, :count).by(2)
         .and change(CompensationRecord, :count).by(2)
         .and change(CompensationComponent, :count).by(4)

        job.reload
        expect(job.status).to eq("completed")
        expect(job.total_rows).to eq(2)
        expect(job.processed_rows).to eq(2)
        expect(job.successful_rows).to eq(2)
        expect(job.failed_rows).to eq(0)
        expect(job.error_summary).to be_empty
        expect(job.completed_at).to be_present

        emp1 = Employee.find_by(employee_number: "IMP0001")
        expect(emp1.first_name).to eq("John")
        expect(emp1.domain).to eq(domain_eng)
        expect(emp1.compensation_records.count).to eq(1)

        comp1 = emp1.compensation_records.first
        expect(comp1.currency).to eq("USD")
        expect(comp1.total_annualized_compensation).to eq(BigDecimal("140000.00"))
      end
    end

    context "when HR Manager imports a row for an unauthorized domain" do
      let(:csv_rows) do
        [
          {
            "employee_number" => "IMP0003",
            "first_name" => "Alice",
            "last_name" => "Walker",
            "email" => "alice.sales@example.com",
            "domain_name" => "Sales", # hr_eng does NOT have Sales domain access!
            "country_code" => "US",
            "job_title" => "Sales Rep",
            "employment_status" => "active",
            "hire_date" => "2024-03-01",
            "currency" => "USD",
            "pay_frequency" => "annual",
            "effective_date" => "2024-03-01",
            "base_salary" => "90000.00",
            "bonus" => "0.00"
          }
        ]
      end

      let(:file_path) { create_csv_file("unauthorized_domain.csv", csv_rows) }
      let(:job) { create(:import_job, tenant: tenant, user: hr_eng, file_path: file_path) }

      it "rejects the unauthorized row and marks job failed or completed_with_errors" do
        expect {
          described_class.new.perform(job.id)
        }.not_to change(Employee, :count)

        job.reload
        expect(job.status).to eq("failed")
        expect(job.successful_rows).to eq(0)
        expect(job.failed_rows).to eq(1)
        expect(job.error_summary.first["errors"].first).to match(/outside your assigned scope/i)
      end
    end

    context "when CSV contains mixed valid and invalid rows" do
      let(:csv_rows) do
        [
          {
            "employee_number" => "IMP0004",
            "first_name" => "Valid",
            "last_name" => "Employee",
            "email" => "valid@example.com",
            "domain_name" => "Engineering",
            "country_code" => "US",
            "job_title" => "Dev",
            "employment_status" => "active",
            "hire_date" => "2024-01-01",
            "currency" => "USD",
            "pay_frequency" => "annual",
            "effective_date" => "2024-01-01",
            "base_salary" => "100000.00",
            "bonus" => "0.00"
          },
          {
            "employee_number" => "IMP0005",
            "first_name" => "", # Invalid: missing first name
            "last_name" => "Invalid",
            "email" => "not-an-email", # Invalid email
            "domain_name" => "Engineering",
            "country_code" => "US",
            "job_title" => "Dev",
            "employment_status" => "active",
            "hire_date" => "2024-01-01",
            "currency" => "USD",
            "pay_frequency" => "annual",
            "effective_date" => "2024-01-01",
            "base_salary" => "100000.00",
            "bonus" => "0.00"
          }
        ]
      end

      let(:file_path) { create_csv_file("mixed.csv", csv_rows) }
      let(:job) { create(:import_job, tenant: tenant, user: admin, file_path: file_path) }

      it "saves valid row, logs error on invalid row, and completes with errors" do
        expect {
          described_class.new.perform(job.id)
        }.to change(Employee, :count).by(1)

        job.reload
        expect(job.status).to eq("completed_with_errors")
        expect(job.total_rows).to eq(2)
        expect(job.successful_rows).to eq(1)
        expect(job.failed_rows).to eq(1)
        expect(job.error_summary.length).to eq(1)
        expect(job.error_summary.first["row"]).to eq(3) # row index (header is 1, first data row 2, second data row 3)
      end
    end
  end
end
