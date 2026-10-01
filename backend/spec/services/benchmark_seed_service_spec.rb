# frozen_string_literal: true

require "rails_helper"

RSpec.describe BenchmarkSeedService do
  describe ".seed_benchmark!" do
    let(:tenant_name) { "Test Benchmark Corp" }

    after do
      tenant = Tenant.find_by(name: tenant_name)
      if tenant
        CompensationComponent.where(tenant: tenant).delete_all
        CompensationRecord.where(tenant: tenant).delete_all
        Employee.where(tenant: tenant).delete_all
        UserDomainAssignment.where(tenant: tenant).delete_all
        User.where(tenant: tenant).delete_all
        Domain.where(tenant: tenant).delete_all
        tenant.destroy
      end
    end

    it "deterministically seeds synthetic employees with compensation packages (SEED-01)" do
      result = described_class.seed_benchmark!(
        tenant_name: tenant_name,
        count: 250,
        batch_size: 100,
        force: true
      )

      tenant = result[:tenant]
      expect(result[:count]).to eq(250)
      expect(Employee.where(tenant: tenant).count).to eq(250)

      # Verify all seeded employees have valid associations
      employees = Employee.where(tenant: tenant).includes(:domain)
      expect(employees.pluck(:domain_id).compact.size).to eq(250)
      expect(employees.pluck(:country_code).all?(&:present?)).to be(true)
      expect(employees.pluck(:job_title).all?(&:present?)).to be(true)

      # Verify compensation packages and components
      comp_records = CompensationRecord.where(tenant: tenant)
      expect(comp_records.count).to eq(250)
      expect(comp_records.pluck(:currency).uniq.size).to be >= 5

      components = CompensationComponent.where(tenant: tenant)
      expect(components.count).to be >= 250 # At least base salary for each
      expect(components.where(component_type: "base_salary").count).to eq(250)
    end

    it "is idempotent and does not duplicate records when re-run without force" do
      described_class.seed_benchmark!(tenant_name: tenant_name, count: 50, batch_size: 50, force: true)
      tenant = Tenant.find_by!(name: tenant_name)
      expect(Employee.where(tenant: tenant).count).to eq(50)

      # Re-run without force
      second_run = described_class.seed_benchmark!(tenant_name: tenant_name, count: 50, batch_size: 50, force: false)
      expect(second_run[:count]).to eq(50)
      expect(Employee.where(tenant: tenant).count).to eq(50)
    end

    it "produces deterministic output with identical attributes given the same seed" do
      result1 = described_class.seed_benchmark!(tenant_name: tenant_name, count: 20, batch_size: 20, force: true)
      tenant = result1[:tenant]
      first_run_sample = Employee.where(tenant: tenant).order(:employee_number).pluck(:employee_number, :email, :job_title)

      # Re-seed with force (triggers fresh generation with srand(42))
      described_class.seed_benchmark!(tenant_name: tenant_name, count: 20, batch_size: 20, force: true)
      second_run_sample = Employee.where(tenant: tenant).order(:employee_number).pluck(:employee_number, :email, :job_title)

      expect(second_run_sample).to eq(first_run_sample)
    end

    it "creates an Organization Admin and HR Manager user for the benchmark tenant" do
      described_class.seed_benchmark!(tenant_name: tenant_name, count: 10, batch_size: 10, force: true)
      tenant = Tenant.find_by!(name: tenant_name)

      admin = User.find_by(tenant: tenant, email: "admin@globex.com")
      expect(admin).to be_present
      expect(admin.role).to eq("organization_admin")
      expect(admin.authenticate("password123")).to be_truthy

      hr = User.find_by(tenant: tenant, email: "hr@globex.com")
      expect(hr).to be_present
      expect(hr.role).to eq("hr_manager")
      expect(hr.domains.pluck(:name)).to include("Engineering")
    end

    it "strictly enforces PostgreSQL Row-Level Security tenant isolation" do
      # Seed demo tenant and benchmark tenant
      demo_tenant = described_class.seed_acme_demo!
      benchmark_result = described_class.seed_benchmark!(tenant_name: tenant_name, count: 50, batch_size: 50, force: true)
      benchmark_tenant = benchmark_result[:tenant]

      # As Demo Tenant under RLS
      ActiveRecord::Base.transaction do
        ActiveRecord::Base.connection.execute("SET LOCAL ROLE app_user")
        ActiveRecord::Base.connection.execute("SET LOCAL app.current_tenant_id = '#{demo_tenant.id}'")

        expect(Employee.count).to eq(4)
        expect(Employee.where(tenant_id: benchmark_tenant.id).count).to eq(0)
      end

      # As Benchmark Tenant under RLS
      ActiveRecord::Base.transaction do
        ActiveRecord::Base.connection.execute("SET LOCAL ROLE app_user")
        ActiveRecord::Base.connection.execute("SET LOCAL app.current_tenant_id = '#{benchmark_tenant.id}'")

        expect(Employee.count).to eq(50)
        expect(Employee.where(tenant_id: demo_tenant.id).count).to eq(0)
      end
    end
  end
end
