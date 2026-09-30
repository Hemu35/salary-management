require "rails_helper"

RSpec.describe CompensationRecord, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:tenant) }
    it { is_expected.to belong_to(:employee) }
    it { is_expected.to belong_to(:created_by).class_name("User").optional }
    it { is_expected.to belong_to(:approved_by).class_name("User").optional }
    it { is_expected.to have_many(:compensation_components).dependent(:destroy) }
  end

  describe "validations" do
    subject { build(:compensation_record) }

    it { is_expected.to validate_presence_of(:effective_date) }
    it { is_expected.to validate_presence_of(:currency) }
    it { is_expected.to validate_presence_of(:pay_frequency) }
    it { is_expected.to validate_presence_of(:status) }

    it { is_expected.to validate_inclusion_of(:pay_frequency).in_array(%w[annual monthly bi_weekly hourly]) }
    it { is_expected.to validate_inclusion_of(:status).in_array(%w[draft approved active superseded]) }

    it "validates currency is 3 uppercase letters" do
      expect(build(:compensation_record, currency: "USD")).to be_valid
      expect(build(:compensation_record, currency: "EUR")).to be_valid
      expect(build(:compensation_record, currency: "US")).not_to be_valid
      expect(build(:compensation_record, currency: "USDD")).not_to be_valid
    end

    it "normalizes currency to uppercase" do
      record = create(:compensation_record, currency: "eur")
      expect(record.reload.currency).to eq("EUR")
    end

    it "rejects duplicate effective_date for the same employee within tenant" do
      tenant = create(:tenant)
      employee = create(:employee, tenant: tenant)
      create(:compensation_record, tenant: tenant, employee: employee, effective_date: Date.current)
      duplicate = build(:compensation_record, tenant: tenant, employee: employee, effective_date: Date.current)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:effective_date]).to be_present
    end

    it "allows same effective_date for different employees" do
      tenant = create(:tenant)
      emp1 = create(:employee, tenant: tenant)
      emp2 = create(:employee, tenant: tenant)
      create(:compensation_record, tenant: tenant, employee: emp1, effective_date: Date.current)
      different_emp_record = build(:compensation_record, tenant: tenant, employee: emp2, effective_date: Date.current)
      expect(different_emp_record).to be_valid
    end
  end

  describe "tenant boundary integrity" do
    let(:tenant_a) { create(:tenant, name: "Tenant A") }
    let(:tenant_b) { create(:tenant, name: "Tenant B") }
    let(:emp_b) { create(:employee, tenant: tenant_b) }
    let(:user_b) { create(:user, tenant: tenant_b) }

    it "rejects employee from a different tenant" do
      record = build(:compensation_record, tenant: tenant_a, employee: emp_b)
      expect(record).not_to be_valid
      expect(record.errors[:employee]).to include("must belong to the same tenant organization")
    end

    it "rejects created_by user from a different tenant" do
      emp_a = create(:employee, tenant: tenant_a)
      record = build(:compensation_record, tenant: tenant_a, employee: emp_a, created_by: user_b)
      expect(record).not_to be_valid
      expect(record.errors[:created_by]).to include("must belong to the same tenant organization")
    end
  end

  describe "calculations" do
    let(:tenant) { create(:tenant) }
    let(:employee) { create(:employee, tenant: tenant) }
    let(:record) { create(:compensation_record, tenant: tenant, employee: employee) }

    it "calculates total annualized compensation accurately using BigDecimal" do
      create(:compensation_component,
        tenant: tenant,
        compensation_record: record,
        component_type: "base_salary",
        amount: BigDecimal("120000.00"),
        frequency: "annual"
      )
      create(:compensation_component,
        tenant: tenant,
        compensation_record: record,
        component_type: "bonus",
        amount: BigDecimal("15000.00"),
        frequency: "annual"
      )
      create(:compensation_component,
        tenant: tenant,
        compensation_record: record,
        component_type: "allowance",
        amount: BigDecimal("500.00"),
        frequency: "monthly"
      )

      # 120,000 + 15,000 + (500 * 12 = 6,000) = 141,000.00
      expect(record.total_annualized_compensation).to eq(BigDecimal("141000.00"))
    end

    it "returns base salary amount directly" do
      create(:compensation_component,
        tenant: tenant,
        compensation_record: record,
        component_type: "base_salary",
        amount: BigDecimal("125000.00"),
        frequency: "annual"
      )
      create(:compensation_component,
        tenant: tenant,
        compensation_record: record,
        component_type: "bonus",
        amount: BigDecimal("10000.00"),
        frequency: "annual"
      )

      expect(record.base_salary_amount).to eq(BigDecimal("125000.00"))
    end
  end
end
