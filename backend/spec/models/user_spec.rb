require "rails_helper"

RSpec.describe User, type: :model do
  describe "validations" do
    subject { build(:user) }

    it { should belong_to(:tenant) }
    it { should have_many(:user_domain_assignments).dependent(:destroy) }
    it { should have_many(:domains).through(:user_domain_assignments) }

    it { should validate_presence_of(:email) }
    it { should validate_inclusion_of(:role).in_array(User::ROLES) }
    it { should validate_inclusion_of(:status).in_array(%w[active inactive]) }

    it "validates email uniqueness scoped to tenant" do
      tenant = create(:tenant)
      create(:user, tenant: tenant, email: "dup@example.com")
      dup = build(:user, tenant: tenant, email: "dup@example.com")
      expect(dup).not_to be_valid
      expect(dup.errors[:email]).to be_present
    end

    it "allows same email in different tenants" do
      create(:user, email: "shared@example.com")
      user2 = build(:user, tenant: create(:tenant), email: "shared@example.com")
      expect(user2).to be_valid
    end
  end

  describe "#organization_admin?" do
    it "returns true for org_admin role" do
      expect(build(:user, :admin).organization_admin?).to be true
    end

    it "returns false for hr_manager role" do
      expect(build(:user, :hr_manager).organization_admin?).to be false
    end
  end

  describe "#accessible_domain_ids" do
    let(:tenant) { create(:tenant) }
    let(:domain_a) { create(:domain, tenant: tenant) }
    let(:domain_b) { create(:domain, tenant: tenant) }

    it "returns all tenant domain ids for org admin" do
      admin = create(:user, :admin, tenant: tenant)
      domain_a; domain_b
      expect(admin.accessible_domain_ids).to match_array([ domain_a.id, domain_b.id ])
    end

    it "returns only assigned domain ids for hr_manager" do
      hr = create(:user, :hr_manager, tenant: tenant)
      create(:user_domain_assignment, tenant: tenant, user: hr, domain: domain_a)
      domain_b # exists but not assigned
      expect(hr.accessible_domain_ids).to eq([ domain_a.id ])
    end
  end

  describe "#authenticate" do
    it "authenticates with correct password" do
      user = create(:user, password: "secret123")
      expect(user.authenticate("secret123")).to eq(user)
    end

    it "rejects wrong password" do
      user = create(:user, password: "secret123")
      expect(user.authenticate("wrong")).to be_falsy
    end
  end
end
