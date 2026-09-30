class Domain < ApplicationRecord
  belongs_to :tenant
  has_many :user_domain_assignments, dependent: :destroy
  has_many :users, through: :user_domain_assignments

  validates :name, presence: true, uniqueness: { scope: :tenant_id }
  validates :status, inclusion: { in: %w[active inactive] }

  scope :active, -> { where(status: "active") }
end
