# Seeds for Development & Demo Environments

tenant = Tenant.find_or_create_by!(name: "Acme Corporation") do |t|
  t.status = "active"
end

admin = User.find_or_initialize_by(email: "admin@example.com")
admin.assign_attributes(
  tenant: tenant,
  password: "password123",
  role: "organization_admin",
  status: "active"
)
admin.save!

hr = User.find_or_initialize_by(email: "hr@example.com")
hr.assign_attributes(
  tenant: tenant,
  password: "password123",
  role: "hr_manager",
  status: "active"
)
hr.save!

engineering = Domain.find_or_create_by!(tenant: tenant, name: "Engineering") do |d|
  d.status = "active"
end

sales = Domain.find_or_create_by!(tenant: tenant, name: "Sales & Marketing") do |d|
  d.status = "active"
end

UserDomainAssignment.find_or_create_by!(
  tenant: tenant,
  user: hr,
  domain: engineering
)

employees_data = [
  {
    employee_number: "EMP0001",
    first_name: "Alice",
    last_name: "Walker",
    email: "alice.walker@example.com",
    domain: engineering,
    country_code: "US",
    job_title: "Staff Systems Engineer",
    employment_status: "active",
    hire_date: "2024-03-15"
  },
  {
    employee_number: "EMP0002",
    first_name: "Bob",
    last_name: "Martin",
    email: "bob.martin@example.com",
    domain: engineering,
    country_code: "GB",
    job_title: "Senior Backend Developer",
    employment_status: "active",
    hire_date: "2024-07-01"
  },
  {
    employee_number: "EMP0003",
    first_name: "Carol",
    last_name: "Danvers",
    email: "carol.danvers@example.com",
    domain: sales,
    country_code: "US",
    job_title: "Enterprise Sales Director",
    employment_status: "active",
    hire_date: "2023-11-10"
  },
  {
    employee_number: "EMP0004",
    first_name: "David",
    last_name: "Miller",
    email: "david.miller@example.com",
    domain: sales,
    country_code: "IN",
    job_title: "Product Marketing Lead",
    employment_status: "on_leave",
    hire_date: "2025-01-20"
  }
]

employees_data.each do |data|
  emp = Employee.find_or_initialize_by(tenant: tenant, employee_number: data[:employee_number])
  emp.assign_attributes(data.merge(tenant: tenant))
  emp.save!
end

# Seed initial compensation packages
comp_packages = {
  "EMP0001" => {
    currency: "USD",
    effective_date: "2024-03-15",
    components: [
      { component_type: "base_salary", amount: BigDecimal("165000.00"), frequency: "annual" },
      { component_type: "bonus", amount: BigDecimal("25000.00"), frequency: "annual" }
    ]
  },
  "EMP0002" => {
    currency: "GBP",
    effective_date: "2024-07-01",
    components: [
      { component_type: "base_salary", amount: BigDecimal("95000.00"), frequency: "annual" },
      { component_type: "bonus", amount: BigDecimal("10000.00"), frequency: "annual" }
    ]
  },
  "EMP0003" => {
    currency: "USD",
    effective_date: "2023-11-10",
    components: [
      { component_type: "base_salary", amount: BigDecimal("140000.00"), frequency: "annual" },
      { component_type: "commission", amount: BigDecimal("40000.00"), frequency: "annual" }
    ]
  },
  "EMP0004" => {
    currency: "INR",
    effective_date: "2025-01-20",
    components: [
      { component_type: "base_salary", amount: BigDecimal("3500000.00"), frequency: "annual" },
      { component_type: "bonus", amount: BigDecimal("350000.00"), frequency: "annual" }
    ]
  }
}

# Reset demo compensation records and components
CompensationComponent.where(tenant: tenant).delete_all
CompensationRecord.where(tenant: tenant).delete_all

comp_packages.each do |emp_num, comp_info|
  emp = Employee.find_by!(tenant: tenant, employee_number: emp_num)
  rec = CompensationRecord.find_or_initialize_by(tenant: tenant, employee: emp, effective_date: comp_info[:effective_date])
  rec.assign_attributes(
    currency: comp_info[:currency],
    pay_frequency: "annual",
    status: "active",
    notes: "Initial compensation package",
    created_by: admin
  )
  rec.save!

  comp_info[:components].each do |comp|
    c = CompensationComponent.find_or_initialize_by(
      tenant: tenant,
      compensation_record: rec,
      component_type: comp[:component_type]
    )
    c.assign_attributes(comp)
    c.save!
  end
end

puts "✅ Seeded Tenant: #{tenant.name}"
puts "✅ Seeded Org Admin: #{admin.email} (password: password123)"
puts "✅ Seeded HR Manager: #{hr.email} (password: password123)"
puts "✅ Seeded Domains: #{engineering.name}, #{sales.name}"
puts "✅ Seeded #{employees_data.count} demo employees across domains"
puts "✅ Seeded demo compensation packages with components"


