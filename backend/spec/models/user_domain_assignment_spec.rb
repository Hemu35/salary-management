require "rails_helper"

RSpec.describe UserDomainAssignment, type: :model do
  let(:tenant_a) { create(:tenant, name: "Acme Corp") }
  let(:tenant_b) { create(:tenant, name: "Globex Inc") }

  let(:user_a) { create(:user, tenant: tenant_a) }
  let(:domain_a) { create(:domain, tenant: tenant_a) }

  let(:user_b) { create(:user, tenant: tenant_b) }
  let(:domain_b) { create(:domain, tenant: tenant_b) }

  describe "associations" do
    it { should belong_to(:tenant) }
    it { should belong_to(:user) }
    it { should belong_to(:domain) }
  end

  describe "validations" do
    it "allows valid assignment within the same tenant" do
      assignment = build(:user_domain_assignment, tenant: tenant_a, user: user_a, domain: domain_a)
      expect(assignment).to be_valid
    end

    it "rejects duplicate assignment for the same user and domain in a tenant" do
      create(:user_domain_assignment, tenant: tenant_a, user: user_a, domain: domain_a)
      dup = build(:user_domain_assignment, tenant: tenant_a, user: user_a, domain: domain_a)
      expect(dup).not_to be_valid
      expect(dup.errors[:user_id]).to be_present
    end

    context "Multi-Tenant Boundary Security" do
      it "strictly rejects assigning a domain from Tenant B to a user from Tenant A" do
        cross_tenant_assignment = build(:user_domain_assignment,
          tenant: tenant_a,
          user: user_a,
          domain: domain_b
        )
        expect(cross_tenant_assignment).not_to be_valid
        expect(cross_tenant_assignment.errors[:base]).to include("Domain must belong to same tenant")
      end

      it "strictly rejects assignment if the user belongs to Tenant B while tenant_id is Tenant A" do
        mismatched_assignment = build(:user_domain_assignment,
          tenant: tenant_a,
          user: user_b,
          domain: domain_a
        )
        expect(mismatched_assignment).not_to be_valid
        expect(mismatched_assignment.errors[:base]).to include("User must belong to same tenant")
      end
    end
  end
end
