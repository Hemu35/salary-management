# Ensure app_user role exists in PostgreSQL for RLS specs in fresh environments
RSpec.configure do |config|
  config.before(:suite) do
    ActiveRecord::Base.connection.execute(<<-SQL)
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
  end
end
