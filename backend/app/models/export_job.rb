class ExportJob < ApplicationRecord
  belongs_to :tenant
  belongs_to :user

  STATUSES = %w[queued processing completed failed].freeze

  validates :status, inclusion: { in: STATUSES }
  validates :filename, presence: true

  scope :recent_first, -> { order(created_at: :desc) }

  def progress_percentage
    return 100 if completed? || failed?
    return 0 if total_rows.nil? || total_rows.zero?

    ((processed_rows.to_f / total_rows) * 100).round
  end

  def completed?
    status == "completed"
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

  def expired?
    expires_at.present? && expires_at <= Time.current
  end

  def can_download?
    completed? && file_path.present? && File.exist?(file_path) && !expired?
  end
end
