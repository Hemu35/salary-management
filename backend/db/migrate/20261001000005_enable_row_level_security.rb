class EnableRowLevelSecurity < ActiveRecord::Migration[7.2]
  def up
    # 1. Create runtime application DB role without BYPASSRLS or SUPERUSER (LLD §3.2)
    execute <<-SQL
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
          CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END
      $$;

      GRANT USAGE ON SCHEMA public TO app_user;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;
    SQL

    # 2. Enable RLS and define tenant isolation policies on all tenant-owned tables
    tables = %i[users domains user_domain_assignments]

    tables.each do |table|
      execute <<-SQL
        ALTER TABLE #{table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE #{table} FORCE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation_policy ON #{table};

        CREATE POLICY tenant_isolation_policy ON #{table}
          AS PERMISSIVE
          FOR ALL
          TO PUBLIC
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint);
      SQL
    end
  end

  def down
    tables = %i[users domains user_domain_assignments]

    tables.each do |table|
      execute <<-SQL
        DROP POLICY IF EXISTS tenant_isolation_policy ON #{table};
        ALTER TABLE #{table} NO FORCE ROW LEVEL SECURITY;
        ALTER TABLE #{table} DISABLE ROW LEVEL SECURITY;
      SQL
    end

    execute <<-SQL
      REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM app_user;
      REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM app_user;
      REVOKE USAGE ON SCHEMA public FROM app_user;
      DROP ROLE IF EXISTS app_user;
    SQL
  end
end
