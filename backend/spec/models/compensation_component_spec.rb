require "rails_helper"

RSpec.describe CompensationComponent, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:tenant) }
    it { is_expected.to belong_to(:compensation_record) }
  end

  describe "validations" do
    subject { build(:compensation_component) }

    it { is_expected.to validate_presence_of(:component_type) }
    it { is_expected.to validate_presence_of(:amount) }
    it { is_expected.to validate_presence_of(:frequency) }

    it { is_expected.to validate_inclusion_of(:component_type).in_array(%w[base_salary bonus stock_grant allowance commission]) }
    it { is_expected.to validate_inclusion_of(:frequency).in_array(%w[annual monthly bi_weekly hourly one_time]) }

    it { is_expected.to validate_numericality_of(:amount).is_greater_than_or_equal_to(0) }

    it "validates percentage between 0 and 100 if present" do
      expect(build(:compensation_component, percentage: 15.5)).to be_valid
      expect(build(:compensation_component, percentage: -1.0)).not_to be_valid
      expect(build(:compensation_component, percentage: 101.0)).not_to be_valid
    end
  end

  describe "tenant boundary integrity" do
    let(:tenant_a) { create(:tenant, name: "Tenant A") }
    let(:tenant_b) { create(:tenant, name: "Tenant B") }
    let(:record_b) { create(:compensation_record, tenant: tenant_b) }

    it "rejects compensation_record belonging to a different tenant" do
      component = build(:compensation_component, tenant: tenant_a, compensation_record: record_b)
      expect(component).not_to be_valid
      expect(component.errors[:compensation_record]).to include("must belong to the same tenant organization")
    end
  end

  describe "annualized amount calculation" do
    let(:record) { create(:compensation_record) }

    it "calculates annualized amount for annual frequency" do
      component = build(:compensation_component, amount: BigDecimal("100000.00"), frequency: "annual")
      expect(component.annualized_amount).to eq(BigDecimal("100000.00"))
    end

    it "calculates annualized amount for monthly frequency" do
      component = build(:compensation_component, amount: BigDecimal("5000.00"), frequency: "monthly")
      expect(component.annualized_amount).to eq(BigDecimal("60000.00"))
    end

    it "calculates annualized amount for bi_weekly frequency" do
      component = build(:compensation_component, amount: BigDecimal("2000.00"), frequency: "bi_weekly")
      expect(component.annualized_amount).to eq(BigDecimal("52000.00"))
    end

    it "calculates annualized amount for hourly frequency (2080 standard hours)" do
      component = build(:compensation_component, amount: BigDecimal("50.00"), frequency: "hourly")
      expect(component.annualized_amount).to eq(BigDecimal("104000.00"))
    end

    it "treats one_time bonus as single year amount" do
      component = build(:compensation_component, amount: BigDecimal("15000.00"), frequency: "one_time")
      expect(component.annualized_amount).to eq(BigDecimal("15000.00"))
    end
  end
end
