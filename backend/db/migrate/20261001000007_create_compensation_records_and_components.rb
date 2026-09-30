class CreateCompensationRecordsAndComponents < ActiveRecord::Migration[7.2]
  def change
    create_table :compensation_records do |t|
      t.references :tenant, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.references :employee, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.date :effective_date, null: false
      t.string :currency, null: false, limit: 3, default: "USD"
      t.string :pay_frequency, null: false, limit: 20, default: "annual"
      t.string :status, null: false, limit: 20, default: "active"
      t.bigint :created_by_id
      t.bigint :approved_by_id
      t.text :notes

      t.timestamps
    end

    add_foreign_key :compensation_records, :users, column: :created_by_id, on_delete: :nullify
    add_foreign_key :compensation_records, :users, column: :approved_by_id, on_delete: :nullify

    add_index :compensation_records, [ :tenant_id, :employee_id, :effective_date ], name: "index_comp_records_on_tenant_emp_and_date"
    add_index :compensation_records, [ :employee_id, :effective_date ]
    add_index :compensation_records, [ :tenant_id, :status ]

    create_table :compensation_components do |t|
      t.references :tenant, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.references :compensation_record, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.string :component_type, null: false, limit: 30
      t.decimal :amount, precision: 15, scale: 2, null: false, default: 0.0
      t.decimal :percentage, precision: 5, scale: 2
      t.string :frequency, null: false, limit: 20, default: "annual"

      t.timestamps
    end

    add_index :compensation_components, [ :compensation_record_id, :component_type ], name: "index_comp_components_on_record_and_type"

    # Enable and force PostgreSQL Row-Level Security for defense-in-depth isolation
    reversible do |dir|
      dir.up do
        execute <<-SQL
          GRANT ALL PRIVILEGES ON TABLE compensation_records TO app_user;
          GRANT ALL PRIVILEGES ON SEQUENCE compensation_records_id_seq TO app_user;

          ALTER TABLE compensation_records ENABLE ROW LEVEL SECURITY;
          ALTER TABLE compensation_records FORCE ROW LEVEL SECURITY;

          CREATE POLICY tenant_isolation_policy ON compensation_records
            AS PERMISSIVE
            FOR ALL
            TO PUBLIC
            USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint);

          GRANT ALL PRIVILEGES ON TABLE compensation_components TO app_user;
          GRANT ALL PRIVILEGES ON SEQUENCE compensation_components_id_seq TO app_user;

          ALTER TABLE compensation_components ENABLE ROW LEVEL SECURITY;
          ALTER TABLE compensation_components FORCE ROW LEVEL SECURITY;

          CREATE POLICY tenant_isolation_policy ON compensation_components
            AS PERMISSIVE
            FOR ALL
            TO PUBLIC
            USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint);
        SQL
      end

      dir.down do
        execute <<-SQL
          DROP POLICY IF EXISTS tenant_isolation_policy ON compensation_components;
          ALTER TABLE compensation_components NO FORCE ROW LEVEL SECURITY;
          ALTER TABLE compensation_components DISABLE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS tenant_isolation_policy ON compensation_records;
          ALTER TABLE compensation_records NO FORCE ROW LEVEL SECURITY;
          ALTER TABLE compensation_records DISABLE ROW LEVEL SECURITY;
        SQL
      end
    end
  end
end
