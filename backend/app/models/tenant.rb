class Tenant < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :domains, dependent: :destroy
  has_many :user_domain_assignments, dependent: :destroy

  validates :name, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[active inactive] }

  scope :active, -> { where(status: "active") }
end
