class CreateTenants < ActiveRecord::Migration[7.2]
  def change
    create_table :tenants do |t|
      t.string :name, null: false
      t.string :status, null: false, default: "active"
      t.timestamps
    end

    add_index :tenants, :name, unique: true
    add_index :tenants, :status
  end
end
