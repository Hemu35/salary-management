class CreateUsers < ActiveRecord::Migration[7.2]
  def change
    create_table :users do |t|
      t.references :tenant, null: false, foreign_key: true
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :role, null: false, default: "hr_manager"
      t.string :status, null: false, default: "active"
      t.timestamps
    end

    add_index :users, [ :tenant_id, :email ], unique: true
    add_index :users, :email
    add_index :users, :role
  end
end
