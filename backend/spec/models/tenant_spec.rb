require "rails_helper"

RSpec.describe Tenant, type: :model do
  describe "associations" do
    it { should have_many(:users).dependent(:destroy) }
    it { should have_many(:domains).dependent(:destroy) }
    it { should have_many(:user_domain_assignments).dependent(:destroy) }
  end

  describe "validations" do
    subject { build(:tenant) }

    it { should validate_presence_of(:name) }
    it { should validate_uniqueness_of(:name) }
    it { should validate_inclusion_of(:status).in_array(%w[active inactive]) }
  end

  describe "scopes" do
    let!(:active_tenant) { create(:tenant, status: "active") }
    let!(:inactive_tenant) { create(:tenant, status: "inactive") }

    it "filters active tenants with .active scope" do
      expect(described_class.active).to include(active_tenant)
      expect(described_class.active).not_to include(inactive_tenant)
    end
  end

  describe "cascade deletion" do
    it "destroys associated users and domains when destroyed" do
      tenant = create(:tenant)
      user = create(:user, tenant: tenant)
      domain = create(:domain, tenant: tenant)
      create(:user_domain_assignment, tenant: tenant, user: user, domain: domain)

      expect { tenant.destroy }.to change(User, :count).by(-1)
                                .and change(Domain, :count).by(-1)
                                .and change(UserDomainAssignment, :count).by(-1)
    end
  end
end
