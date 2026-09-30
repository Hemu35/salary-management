class UserDomainAssignment < ApplicationRecord
  belongs_to :tenant
  belongs_to :user
  belongs_to :domain

  validates :user_id, uniqueness: { scope: [ :tenant_id, :domain_id ] }
  validate :all_records_same_tenant

  private

  def all_records_same_tenant
    if user && domain && tenant
      errors.add(:base, "User must belong to same tenant") unless user.tenant_id == tenant_id
      errors.add(:base, "Domain must belong to same tenant") unless domain.tenant_id == tenant_id
    end
  end
end
