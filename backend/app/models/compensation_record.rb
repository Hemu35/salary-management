class CompensationRecord < ApplicationRecord
  VALID_PAY_FREQUENCIES = %w[annual monthly bi_weekly hourly].freeze
  VALID_STATUSES = %w[draft approved active superseded].freeze

  belongs_to :tenant
  belongs_to :employee
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :approved_by, class_name: "User", optional: true
  has_many :compensation_components, dependent: :destroy

  accepts_nested_attributes_for :compensation_components, allow_destroy: true

  before_validation :normalize_attributes

  validates :effective_date, presence: true
  validates :currency, presence: true, format: { with: /\A[A-Z]{3}\z/, message: "must be a 3-letter ISO currency code" }
  validates :pay_frequency, presence: true, inclusion: { in: VALID_PAY_FREQUENCIES }
  validates :status, presence: true, inclusion: { in: VALID_STATUSES }
  validates :effective_date, uniqueness: { scope: %i[tenant_id employee_id], message: "record already exists for this employee on the specified effective date" }

  validate :validate_tenant_boundaries

  scope :by_employee, ->(emp_id) { where(employee_id: emp_id) }
  scope :active, -> { where(status: "active") }
  scope :ordered_by_date, -> { order(effective_date: :desc) }

  def total_annualized_compensation
    compensation_components.sum(&:annualized_amount)
  end

  def base_salary_amount
    base_comp = compensation_components.find { |c| c.component_type == "base_salary" }
    base_comp&.amount || BigDecimal("0.00")
  end

  private

  def normalize_attributes
    self.currency = currency.to_s.strip.upcase if currency.present?
  end

  def validate_tenant_boundaries
    return unless tenant_id.present?

    if employee.present? && employee.tenant_id != tenant_id
      errors.add(:employee, "must belong to the same tenant organization")
    end

    if created_by.present? && created_by.tenant_id != tenant_id
      errors.add(:created_by, "must belong to the same tenant organization")
    end

    if approved_by.present? && approved_by.tenant_id != tenant_id
      errors.add(:approved_by, "must belong to the same tenant organization")
    end
  end
end
