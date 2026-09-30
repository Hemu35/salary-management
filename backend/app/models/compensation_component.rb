class CompensationComponent < ApplicationRecord
  VALID_COMPONENT_TYPES = %w[base_salary bonus stock_grant allowance commission].freeze
  VALID_FREQUENCIES = %w[annual monthly bi_weekly hourly one_time].freeze

  belongs_to :tenant
  belongs_to :compensation_record

  validates :component_type, presence: true, inclusion: { in: VALID_COMPONENT_TYPES }
  validates :amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :frequency, presence: true, inclusion: { in: VALID_FREQUENCIES }
  validates :percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  validate :validate_tenant_boundaries

  def annualized_amount
    return BigDecimal("0.00") unless amount.present?

    case frequency
    when "annual", "one_time"
      amount
    when "monthly"
      amount * 12
    when "bi_weekly"
      amount * 26
    when "hourly"
      amount * 2080 # Standard 40 hours * 52 weeks
    else
      amount
    end
  end

  private

  def validate_tenant_boundaries
    return unless tenant_id.present? && compensation_record.present?

    if compensation_record.tenant_id != tenant_id
      errors.add(:compensation_record, "must belong to the same tenant organization")
    end
  end
end
