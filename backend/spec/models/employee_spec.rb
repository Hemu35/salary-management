require "rails_helper"

RSpec.describe Employee, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:tenant) }
    it { is_expected.to belong_to(:domain) }
  end

  describe "validations" do
    subject { build(:employee) }

    it { is_expected.to validate_presence_of(:employee_number) }
    it { is_expected.to validate_presence_of(:first_name) }
    it { is_expected.to validate_presence_of(:last_name) }
    it { is_expected.to validate_presence_of(:email) }
    it { is_expected.to validate_presence_of(:country_code) }
    it { is_expected.to validate_presence_of(:job_title) }
    it { is_expected.to validate_presence_of(:hire_date) }

    it { is_expected.to validate_inclusion_of(:employment_status).in_array(%w[active terminated on_leave]) }

    it "validates uniqueness of employee_number scoped to tenant" do
      create(:employee, tenant: subject.tenant, employee_number: "EMP0001")
      duplicate = build(:employee, tenant: subject.tenant, employee_number: "EMP0001")
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:employee_number]).to be_present
    end

    it "allows same employee_number across different tenants" do
      other_tenant = create(:tenant)
      create(:employee, tenant: other_tenant, employee_number: "EMP0001")
      subject.employee_number = "EMP0001"
      expect(subject).to be_valid
    end

    it "validates uniqueness of email scoped to tenant" do
      create(:employee, tenant: subject.tenant, email: "same@example.com")
      duplicate = build(:employee, tenant: subject.tenant, email: "same@example.com")
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:email]).to be_present
    end

    it "validates email format" do
      employee = build(:employee, email: "invalid-email")
      expect(employee).not_to be_valid
      expect(employee.errors[:email]).to be_present
    end

    it "normalizes email to lowercase before saving" do
      employee = create(:employee, email: "TEST.USER@EXAMPLE.COM")
      expect(employee.reload.email).to eq("test.user@example.com")
    end

    it "validates country_code is exactly 2 uppercase letters" do
      expect(build(:employee, country_code: "US")).to be_valid
      expect(build(:employee, country_code: "GB")).to be_valid
      expect(build(:employee, country_code: "USA")).not_to be_valid
      expect(build(:employee, country_code: "12")).not_to be_valid
    end

    it "normalizes country_code to uppercase before saving" do
      employee = create(:employee, country_code: "us")
      expect(employee.reload.country_code).to eq("US")
    end
  end

  describe "tenant domain boundary integrity" do
    let(:tenant_a) { create(:tenant, name: "Tenant A") }
    let(:tenant_b) { create(:tenant, name: "Tenant B") }
    let(:domain_b) { create(:domain, tenant: tenant_b, name: "Domain B") }

    it "rejects assigning an employee to a domain belonging to a different tenant" do
      employee = build(:employee, tenant: tenant_a, domain: domain_b)
      expect(employee).not_to be_valid
      expect(employee.errors[:domain]).to include("must belong to the same tenant organization")
    end
  end

  describe "scopes and search" do
    let!(:tenant) { create(:tenant) }
    let!(:eng_domain) { create(:domain, tenant: tenant, name: "Engineering") }
    let!(:sales_domain) { create(:domain, tenant: tenant, name: "Sales") }

    let!(:emp1) do
      create(:employee,
        tenant: tenant,
        domain: eng_domain,
        employee_number: "EMP0100",
        first_name: "Alice",
        last_name: "Smith",
        email: "alice@example.com",
        employment_status: "active",
        country_code: "US"
      )
    end

    let!(:emp2) do
      create(:employee,
        tenant: tenant,
        domain: sales_domain,
        employee_number: "EMP0200",
        first_name: "Bob",
        last_name: "Jones",
        email: "bob@example.com",
        employment_status: "terminated",
        country_code: "GB"
      )
    end

    it "filters by domain_id" do
      expect(Employee.by_domain(eng_domain.id)).to contain_exactly(emp1)
      expect(Employee.by_domain(sales_domain.id)).to contain_exactly(emp2)
    end

    it "filters by employment_status" do
      expect(Employee.by_status("active")).to contain_exactly(emp1)
      expect(Employee.by_status("terminated")).to contain_exactly(emp2)
    end

    it "searches across first_name, last_name, email, and employee_number case-insensitively" do
      expect(Employee.search("alice")).to contain_exactly(emp1)
      expect(Employee.search("JONES")).to contain_exactly(emp2)
      expect(Employee.search("bob@example")).to contain_exactly(emp2)
      expect(Employee.search("0100")).to contain_exactly(emp1)
      expect(Employee.search("nonexistent")).to be_empty
    end
  end
end
