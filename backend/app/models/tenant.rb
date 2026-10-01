class Tenant < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :domains, dependent: :destroy
  has_many :user_domain_assignments, dependent: :destroy
  has_many :employees, dependent: :destroy
  has_many :compensation_records, dependent: :destroy
  has_many :compensation_components, dependent: :destroy
  has_many :import_jobs, dependent: :destroy
  has_many :export_jobs, dependent: :destroy

  validates :name, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[active inactive] }

  scope :active, -> { where(status: "active") }

  def self.with_tenant_context(tenant_id, &block)
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute(
        ActiveRecord::Base.sanitize_sql(
          [ "SELECT set_config('app.current_tenant_id', ?, true)", tenant_id.to_s ]
        )
      )
      block.call
    end
  end

  def with_tenant_context(&block)
    self.class.with_tenant_context(id, &block)
  end
end
