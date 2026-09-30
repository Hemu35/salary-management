class Employee < ApplicationRecord
  belongs_to :tenant
  belongs_to :domain

  STATUSES = %w[active terminated on_leave].freeze

  validates :employee_number, presence: true,
            uniqueness: { scope: :tenant_id }
  validates :first_name, :last_name, :job_title, :hire_date, presence: true
  validates :email, presence: true,
            format: { with: URI::MailTo::EMAIL_REGEXP },
            uniqueness: { scope: :tenant_id, case_sensitive: false }
  validates :country_code, presence: true,
            format: { with: /\A[A-Z]{2}\z/, message: "must be a valid 2-letter ISO country code" }
  validates :employment_status, inclusion: { in: STATUSES }

  validate :domain_belongs_to_tenant

  before_validation :normalize_attributes

  # Scopes
  scope :by_domain, ->(domain_id) { where(domain_id: domain_id) if domain_id.present? }
  scope :by_status, ->(status) { where(employment_status: status) if status.present? }
  scope :by_country, ->(country) { where(country_code: country.to_s.upcase) if country.present? }
  scope :active, -> { where(employment_status: "active") }

  scope :search, ->(query) {
    if query.present?
      sanitized = "%#{sanitize_sql_like(query.to_s.strip)}%"
      where(
        "first_name ILIKE :q OR last_name ILIKE :q OR email ILIKE :q OR employee_number ILIKE :q",
        q: sanitized
      )
    end
  }

  private

  def domain_belongs_to_tenant
    return unless domain && tenant_id
    if domain.tenant_id != tenant_id
      errors.add(:domain, "must belong to the same tenant organization")
    end
  end

  def normalize_attributes
    self.email = email.to_s.strip.downcase if email.present?
    self.country_code = country_code.to_s.strip.upcase if country_code.present?
    self.employee_number = employee_number.to_s.strip if employee_number.present?
  end
end
