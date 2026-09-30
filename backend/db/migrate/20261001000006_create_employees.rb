class CreateEmployees < ActiveRecord::Migration[7.2]
  def change
    create_table :employees do |t|
      t.references :tenant, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.references :domain, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.string :employee_number, null: false
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.string :email, null: false
      t.string :country_code, null: false, limit: 2
      t.string :job_title, null: false
      t.string :employment_status, null: false, default: "active"
      t.date :hire_date, null: false

      t.timestamps
    end

    add_index :employees, [ :tenant_id, :employee_number ], unique: true
    add_index :employees, [ :tenant_id, :email ], unique: true
    add_index :employees, [ :tenant_id, :domain_id ]
    add_index :employees, [ :tenant_id, :employment_status ]

    # Enable and force PostgreSQL Row-Level Security with tenant isolation policy
    reversible do |dir|
      dir.up do
        execute <<-SQL
          GRANT ALL PRIVILEGES ON TABLE employees TO app_user;
          GRANT ALL PRIVILEGES ON SEQUENCE employees_id_seq TO app_user;

          ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
          ALTER TABLE employees FORCE ROW LEVEL SECURITY;

          CREATE POLICY tenant_isolation_policy ON employees
            AS PERMISSIVE
            FOR ALL
            TO PUBLIC
            USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint);
        SQL
      end

      dir.down do
        execute <<-SQL
          DROP POLICY IF EXISTS tenant_isolation_policy ON employees;
          ALTER TABLE employees NO FORCE ROW LEVEL SECURITY;
          ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
        SQL
      end
    end
  end
end
