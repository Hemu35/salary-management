class User < ApplicationRecord
  has_secure_password

  belongs_to :tenant
  has_many :user_domain_assignments, dependent: :destroy
  has_many :domains, through: :user_domain_assignments
  has_many :import_jobs, dependent: :destroy
  has_many :export_jobs, dependent: :destroy

  ROLES = %w[organization_admin hr_manager].freeze

  validates :email, presence: true,
            format: { with: URI::MailTo::EMAIL_REGEXP },
            uniqueness: { scope: :tenant_id, case_sensitive: false }
  validates :role, inclusion: { in: ROLES }
  validates :status, inclusion: { in: %w[active inactive] }

  before_save { email.downcase! }

  scope :active, -> { where(status: "active") }

  def organization_admin?
    role == "organization_admin"
  end

  def hr_manager?
    role == "hr_manager"
  end

  # Returns domain_ids this user is authorized to access.
  # Org admins can access all domains in their tenant.
  def accessible_domain_ids
    if organization_admin?
      tenant.domains.active.pluck(:id)
    else
      user_domain_assignments.pluck(:domain_id)
    end
  end
end
