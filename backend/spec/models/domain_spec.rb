require "rails_helper"

RSpec.describe Domain, type: :model do
  describe "associations" do
    it { should belong_to(:tenant) }
    it { should have_many(:user_domain_assignments).dependent(:destroy) }
    it { should have_many(:users).through(:user_domain_assignments) }
  end

  describe "validations" do
    subject { build(:domain) }

    it { should validate_presence_of(:name) }
    it { should validate_inclusion_of(:status).in_array(%w[active inactive]) }

    it "validates name uniqueness scoped to tenant" do
      tenant = create(:tenant)
      create(:domain, tenant: tenant, name: "Engineering")
      dup = build(:domain, tenant: tenant, name: "Engineering")
      expect(dup).not_to be_valid
      expect(dup.errors[:name]).to be_present
    end

    it "allows the same domain name across different tenants" do
      create(:domain, tenant: create(:tenant), name: "Engineering")
      domain_other_tenant = build(:domain, tenant: create(:tenant), name: "Engineering")
      expect(domain_other_tenant).to be_valid
    end
  end

  describe "scopes" do
    let(:tenant) { create(:tenant) }
    let!(:active_domain) { create(:domain, tenant: tenant, status: "active") }
    let!(:inactive_domain) { create(:domain, tenant: tenant, status: "inactive") }

    it "filters active domains with .active scope" do
      expect(described_class.active).to include(active_domain)
      expect(described_class.active).not_to include(inactive_domain)
    end
  end
end
