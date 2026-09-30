require "rails_helper"

RSpec.describe "PostgreSQL Row-Level Security (RLS) Tenant Isolation", type: :model, truncation: true do
  let!(:tenant_a) { create(:tenant, name: "Tenant Alpha") }
  let!(:tenant_b) { create(:tenant, name: "Tenant Beta") }

  let!(:user_a) { create(:user, tenant: tenant_a, email: "alpha@example.com") }
  let!(:user_b) { create(:user, tenant: tenant_b, email: "beta@example.com") }

  let!(:domain_a) { create(:domain, tenant: tenant_a, name: "Engineering Alpha") }
  let!(:domain_b) { create(:domain, tenant: tenant_b, name: "Engineering Beta") }

  def execute_as_tenant(tenant, &block)
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute("SET LOCAL ROLE app_user")
      ActiveRecord::Base.connection.execute(
        ActiveRecord::Base.sanitize_sql([ "SELECT set_config('app.current_tenant_id', ?, true)", tenant.id.to_s ])
      )
      block.call
    ensure
      ActiveRecord::Base.connection.execute("RESET ROLE") rescue nil
    end
  end

  def execute_without_tenant(&block)
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute("SET LOCAL ROLE app_user")
      ActiveRecord::Base.connection.execute("SELECT set_config('app.current_tenant_id', '', true)")
      block.call
    ensure
      ActiveRecord::Base.connection.execute("RESET ROLE") rescue nil
    end
  end

  describe "Tenant Data Isolation (TEN-01, TEN-02)" do
    it "prevents selecting rows from other tenants via ActiveRecord and raw SQL" do
      execute_as_tenant(tenant_a) do
        # ActiveRecord queries
        expect(User.pluck(:id)).to contain_exactly(user_a.id)
        expect(User.pluck(:id)).not_to include(user_b.id)
        expect(Domain.pluck(:id)).to contain_exactly(domain_a.id)
        expect(Domain.pluck(:id)).not_to include(domain_b.id)

        # Raw SQL queries
        raw_user_ids = ActiveRecord::Base.connection.select_values("SELECT id FROM users").map(&:to_i)
        expect(raw_user_ids).to contain_exactly(user_a.id)
        expect(raw_user_ids).not_to include(user_b.id)
      end

      execute_as_tenant(tenant_b) do
        expect(User.pluck(:id)).to contain_exactly(user_b.id)
        expect(User.pluck(:id)).not_to include(user_a.id)
        expect(Domain.pluck(:id)).to contain_exactly(domain_b.id)
      end
    end

    it "blocks all rows when no tenant context is set" do
      execute_without_tenant do
        expect(User.count).to eq(0)
        expect(Domain.count).to eq(0)
      end
    end

    it "rejects inserting records with mismatched tenant_id via RLS WITH CHECK policy" do
      execute_as_tenant(tenant_a) do
        # Attempting to insert a user belonging to Tenant B while in Tenant A's context
        expect {
          ActiveRecord::Base.transaction(requires_new: true) do
            ActiveRecord::Base.connection.execute(
              ActiveRecord::Base.sanitize_sql([
                "INSERT INTO users (tenant_id, email, password_digest, role, status, created_at, updated_at) " \
                "VALUES (?, ?, 'digest123', 'hr_manager', 'active', NOW(), NOW())",
                tenant_b.id,
                "malicious_inject@example.com"
              ])
            )
          end
        }.to raise_error(ActiveRecord::StatementInvalid, /violates row-level security policy/)
      end
    end

    it "rejects updating records to another tenant_id via RLS WITH CHECK policy" do
      execute_as_tenant(tenant_a) do
        expect {
          ActiveRecord::Base.transaction(requires_new: true) do
            ActiveRecord::Base.connection.execute(
              ActiveRecord::Base.sanitize_sql([
                "UPDATE users SET tenant_id = ? WHERE id = ?",
                tenant_b.id,
                user_a.id
              ])
            )
          end
        }.to raise_error(ActiveRecord::StatementInvalid, /violates row-level security policy/)
      end
    end
  end

  describe "Connection Pooling & Transaction Cleanliness (TEN-03)" do
    it "does not leak app.current_tenant_id across transactions" do
      execute_as_tenant(tenant_a) do
        setting = ActiveRecord::Base.connection.select_value("SELECT current_setting('app.current_tenant_id', true)")
        expect(setting).to eq(tenant_a.id.to_s)
      end

      # Outside the transaction, the local setting must be reset automatically
      setting_after = ActiveRecord::Base.connection.select_value("SELECT current_setting('app.current_tenant_id', true)")
      expect(setting_after.to_s).to be_empty
    end
  end
end
