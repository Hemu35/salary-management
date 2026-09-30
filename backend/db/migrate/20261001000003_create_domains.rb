class CreateDomains < ActiveRecord::Migration[7.2]
  def change
    create_table :domains do |t|
      t.references :tenant, null: false, foreign_key: true
      t.string :name, null: false
      t.string :status, null: false, default: "active"
      t.timestamps
    end

    add_index :domains, [ :tenant_id, :name ], unique: true
  end
end
