# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_10_01_140000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "compensation_components", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "compensation_record_id", null: false
    t.string "component_type", limit: 30, null: false
    t.decimal "amount", precision: 15, scale: 2, default: "0.0", null: false
    t.decimal "percentage", precision: 5, scale: 2
    t.string "frequency", limit: 20, default: "annual", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["compensation_record_id", "component_type"], name: "index_comp_components_on_record_and_type"
    t.index ["compensation_record_id"], name: "index_compensation_components_on_compensation_record_id"
    t.index ["tenant_id"], name: "index_compensation_components_on_tenant_id"
  end

  create_table "compensation_records", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "employee_id", null: false
    t.date "effective_date", null: false
    t.string "currency", limit: 3, default: "USD", null: false
    t.string "pay_frequency", limit: 20, default: "annual", null: false
    t.string "status", limit: 20, default: "active", null: false
    t.bigint "created_by_id"
    t.bigint "approved_by_id"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["employee_id", "effective_date"], name: "index_compensation_records_on_employee_id_and_effective_date"
    t.index ["employee_id"], name: "index_compensation_records_on_employee_id"
    t.index ["tenant_id", "employee_id", "effective_date"], name: "index_comp_records_on_tenant_emp_and_date"
    t.index ["tenant_id", "status"], name: "index_compensation_records_on_tenant_id_and_status"
    t.index ["tenant_id"], name: "index_compensation_records_on_tenant_id"
  end

  create_table "domains", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.string "name", null: false
    t.string "status", default: "active", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id", "name"], name: "index_domains_on_tenant_id_and_name", unique: true
    t.index ["tenant_id"], name: "index_domains_on_tenant_id"
  end

  create_table "employees", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "domain_id", null: false
    t.string "employee_number", null: false
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "email", null: false
    t.string "country_code", limit: 2, null: false
    t.string "job_title", null: false
    t.string "employment_status", default: "active", null: false
    t.date "hire_date", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["domain_id"], name: "index_employees_on_domain_id"
    t.index ["tenant_id", "domain_id"], name: "index_employees_on_tenant_id_and_domain_id"
    t.index ["tenant_id", "email"], name: "index_employees_on_tenant_id_and_email", unique: true
    t.index ["tenant_id", "employee_number"], name: "index_employees_on_tenant_id_and_employee_number", unique: true
    t.index ["tenant_id", "employment_status"], name: "index_employees_on_tenant_id_and_employment_status"
    t.index ["tenant_id"], name: "index_employees_on_tenant_id"
  end

  create_table "export_jobs", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "user_id", null: false
    t.string "status", limit: 30, default: "queued", null: false
    t.string "filename", null: false
    t.string "file_path"
    t.jsonb "filters", default: {}, null: false
    t.integer "total_rows", default: 0, null: false
    t.integer "processed_rows", default: 0, null: false
    t.text "error_message"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id", "created_at"], name: "index_export_jobs_on_tenant_id_and_created_at"
    t.index ["tenant_id", "status"], name: "index_export_jobs_on_tenant_id_and_status"
    t.index ["tenant_id"], name: "index_export_jobs_on_tenant_id"
    t.index ["user_id"], name: "index_export_jobs_on_user_id"
  end

  create_table "import_jobs", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "user_id", null: false
    t.string "status", limit: 30, default: "queued", null: false
    t.string "filename", null: false
    t.string "file_path", null: false
    t.integer "total_rows", default: 0, null: false
    t.integer "processed_rows", default: 0, null: false
    t.integer "successful_rows", default: 0, null: false
    t.integer "failed_rows", default: 0, null: false
    t.jsonb "error_summary", default: [], null: false
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "rollback_metadata", default: {}, null: false
    t.index ["tenant_id", "created_at"], name: "index_import_jobs_on_tenant_id_and_created_at"
    t.index ["tenant_id", "status"], name: "index_import_jobs_on_tenant_id_and_status"
    t.index ["tenant_id"], name: "index_import_jobs_on_tenant_id"
    t.index ["user_id"], name: "index_import_jobs_on_user_id"
  end

  create_table "tenants", force: :cascade do |t|
    t.string "name", null: false
    t.string "status", default: "active", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_tenants_on_name", unique: true
    t.index ["status"], name: "index_tenants_on_status"
  end

  create_table "user_domain_assignments", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "user_id", null: false
    t.bigint "domain_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["domain_id"], name: "index_user_domain_assignments_on_domain_id"
    t.index ["tenant_id", "user_id", "domain_id"], name: "idx_uda_tenant_user_domain", unique: true
    t.index ["tenant_id"], name: "index_user_domain_assignments_on_tenant_id"
    t.index ["user_id"], name: "index_user_domain_assignments_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.string "email", null: false
    t.string "password_digest", null: false
    t.string "role", default: "hr_manager", null: false
    t.string "status", default: "active", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email"
    t.index ["role"], name: "index_users_on_role"
    t.index ["tenant_id", "email"], name: "index_users_on_tenant_id_and_email", unique: true
    t.index ["tenant_id"], name: "index_users_on_tenant_id"
  end

  add_foreign_key "compensation_components", "compensation_records", on_delete: :cascade
  add_foreign_key "compensation_components", "tenants", on_delete: :cascade
  add_foreign_key "compensation_records", "employees", on_delete: :cascade
  add_foreign_key "compensation_records", "tenants", on_delete: :cascade
  add_foreign_key "compensation_records", "users", column: "approved_by_id", on_delete: :nullify
  add_foreign_key "compensation_records", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "domains", "tenants"
  add_foreign_key "employees", "domains", on_delete: :cascade
  add_foreign_key "employees", "tenants", on_delete: :cascade
  add_foreign_key "export_jobs", "tenants", on_delete: :cascade
  add_foreign_key "export_jobs", "users", on_delete: :cascade
  add_foreign_key "import_jobs", "tenants", on_delete: :cascade
  add_foreign_key "import_jobs", "users", on_delete: :cascade
  add_foreign_key "user_domain_assignments", "domains"
  add_foreign_key "user_domain_assignments", "tenants"
  add_foreign_key "user_domain_assignments", "users"
  add_foreign_key "users", "tenants"
end
