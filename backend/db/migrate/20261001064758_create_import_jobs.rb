class CreateImportJobs < ActiveRecord::Migration[7.2]
  def change
    create_table :import_jobs do |t|
      t.references :tenant, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.string :status, null: false, limit: 30, default: "queued"
      t.string :filename, null: false
      t.string :file_path, null: false
      t.integer :total_rows, null: false, default: 0
      t.integer :processed_rows, null: false, default: 0
      t.integer :successful_rows, null: false, default: 0
      t.integer :failed_rows, null: false, default: 0
      t.jsonb :error_summary, null: false, default: []
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps
    end

    add_index :import_jobs, [ :tenant_id, :status ]
    add_index :import_jobs, [ :tenant_id, :created_at ]

    # Enable and force PostgreSQL Row-Level Security for defense-in-depth isolation
    reversible do |dir|
      dir.up do
        execute <<-SQL
          GRANT ALL PRIVILEGES ON TABLE import_jobs TO app_user;
          GRANT ALL PRIVILEGES ON SEQUENCE import_jobs_id_seq TO app_user;

          ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
          ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

          CREATE POLICY tenant_isolation_policy ON import_jobs
            AS PERMISSIVE
            FOR ALL
            TO PUBLIC
            USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::bigint);
        SQL
      end

      dir.down do
        execute <<-SQL
          DROP POLICY IF EXISTS tenant_isolation_policy ON import_jobs;
          ALTER TABLE import_jobs NO FORCE ROW LEVEL SECURITY;
          ALTER TABLE import_jobs DISABLE ROW LEVEL SECURITY;
        SQL
      end
    end
  end
end
