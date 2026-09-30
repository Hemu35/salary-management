class CreateUserDomainAssignments < ActiveRecord::Migration[7.2]
  def change
    create_table :user_domain_assignments do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.references :domain, null: false, foreign_key: true
      t.timestamps
    end

    add_index :user_domain_assignments, [ :tenant_id, :user_id, :domain_id ], unique: true,
              name: "idx_uda_tenant_user_domain"
  end
end
