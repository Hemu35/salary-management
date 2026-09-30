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

puts "✅ Seeded Tenant: #{tenant.name}"
puts "✅ Seeded Org Admin: #{admin.email} (password: password123)"
puts "✅ Seeded HR Manager: #{hr.email} (password: password123)"
puts "✅ Seeded Domains: #{engineering.name}, #{sales.name}"
