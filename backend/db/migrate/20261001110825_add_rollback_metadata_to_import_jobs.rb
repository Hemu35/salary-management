class AddRollbackMetadataToImportJobs < ActiveRecord::Migration[7.2]
  def change
    add_column :import_jobs, :rollback_metadata, :jsonb, default: {}, null: false
  end
end
