class ImportJob < ApplicationRecord
  belongs_to :tenant
  belongs_to :user

  STATUSES = %w[queued processing completed completed_with_errors failed].freeze

  validates :status, inclusion: { in: STATUSES }
  validates :filename, :file_path, presence: true

  scope :recent_first, -> { order(created_at: :desc) }

  def progress_percentage
    return 100 if completed? || completed_with_errors? || failed?
    return 0 if total_rows.nil? || total_rows.zero?

    ((processed_rows.to_f / total_rows) * 100).round
  end

  def completed?
    status == "completed"
  end

  def completed_with_errors?
    status == "completed_with_errors"
  end

  def failed?
    status == "failed"
  end

  def processing?
    status == "processing"
  end

  def queued?
    status == "queued"
  end
end
