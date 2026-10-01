# frozen_string_literal: true

class BenchmarkSeedService
  DETERMINISTIC_SEED = 42

  FIRST_NAMES = %w[
    James Mary John Patricia Robert Jennifer Michael Linda William Elizabeth
    David Barbara Richard Susan Joseph Jessica Thomas Sarah Charles Karen
    Christopher Nancy Daniel Lisa Matthew Betty Anthony Margaret Mark Sandra
    Donald Ashley Steven Kimberly Paul Emily Andrew Donna Joshua Michelle
    Alexander Laura Kevin Sarah Brian Stephanie Edward Rebecca Ronald Sharon
    Aarav Priya Rohan Ananya Vikram Neha Arjun Pooja Rajesh Deepa
    Liam Emma Oliver Ava Lucas Sophia Matteo Elena Kenji Mei
  ].freeze

  LAST_NAMES = %w[
    Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez
    Hernandez Lopez Gonzalez Wilson Anderson Thomas Taylor Moore Jackson Martin
    Lee Perez Thompson White Harris Sanchez Clark Ramirez Lewis Robinson
    Walker Young Allen King Wright Scott Torres Nguyen Hill Flores
    Green Adams Nelson Baker Hall Sharma Patel Kumar Singh Verma
    Mueller Weber Dubois Laurent Rossi Conti Tanaka Sato Schmidt Fischer
  ].freeze

  DOMAINS = [
    "Engineering",
    "Product Management",
    "Operations & IT",
    "Sales & Marketing",
    "Finance & Legal",
    "Customer Success"
  ].freeze

  COUNTRIES_AND_CURRENCIES = [
    { country: "US", currency: "USD", base_min: 85_000, base_max: 210_000 },
    { country: "GB", currency: "GBP", base_min: 50_000, base_max: 135_000 },
    { country: "DE", currency: "EUR", base_min: 55_000, base_max: 140_000 },
    { country: "FR", currency: "EUR", base_min: 50_000, base_max: 130_000 },
    { country: "IN", currency: "INR", base_min: 1_600_000, base_max: 5_200_000 },
    { country: "CA", currency: "CAD", base_min: 75_000, base_max: 175_000 },
    { country: "AU", currency: "AUD", base_min: 80_000, base_max: 185_000 },
    { country: "JP", currency: "JPY", base_min: 6_500_000, base_max: 16_000_000 },
    { country: "SG", currency: "SGD", base_min: 75_000, base_max: 180_000 }
  ].freeze

  JOB_TITLES = {
    "Engineering" => [
      "Software Engineer", "Senior Software Engineer", "Staff Engineer",
      "Frontend Developer", "DevOps Engineer", "QA Automation Lead", "Engineering Manager"
    ],
    "Product Management" => [
      "Associate PM", "Product Manager", "Senior Product Manager",
      "UX Designer", "Product Design Lead", "Technical Writer"
    ],
    "Operations & IT" => [
      "IT Support Specialist", "Systems Administrator", "Cloud Architect",
      "Information Security Analyst", "Operations Coordinator"
    ],
    "Sales & Marketing" => [
      "Sales Development Rep", "Account Executive", "Enterprise Sales Director",
      "Marketing Manager", "Content Strategist", "Growth Lead"
    ],
    "Finance & Legal" => [
      "Financial Analyst", "Senior Accountant", "Payroll Specialist",
      "Compliance Officer", "Corporate Counsel"
    ],
    "Customer Success" => [
      "Customer Support Specialist", "Customer Success Manager",
      "Technical Account Manager", "Implementation Consultant"
    ]
  }.freeze

  STATUSES = %w[active active active active active active active active on_leave terminated].freeze

  class << self
    def seed_all!(benchmark_count: 10_000, force: false)
      seed_acme_demo!
      seed_benchmark!(tenant_name: "Globex Corporation", count: benchmark_count, force: force)
    end

    def seed_acme_demo!
      tenant = Tenant.find_or_create_by!(name: "Acme Corporation") do |t|
        t.status = "active"
      end

      admin = User.find_or_initialize_by(tenant: tenant, email: "admin@example.com")
      admin.assign_attributes(
        password: "password123",
        role: "organization_admin",
        status: "active"
      )
      admin.save!

      hr = User.find_or_initialize_by(tenant: tenant, email: "hr@example.com")
      hr.assign_attributes(
        password: "password123",
        role: "hr_manager",
        status: "active"
      )
      hr.save!

      engineering = Domain.find_or_create_by!(tenant: tenant, name: "Engineering") { |d| d.status = "active" }
      sales = Domain.find_or_create_by!(tenant: tenant, name: "Sales & Marketing") { |d| d.status = "active" }

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

      CompensationComponent.where(tenant: tenant).delete_all
      CompensationRecord.where(tenant: tenant).delete_all

      comp_packages.each do |emp_num, comp_info|
        emp = Employee.find_by!(tenant: tenant, employee_number: emp_num)
        rec = CompensationRecord.create!(
          tenant: tenant,
          employee: emp,
          effective_date: comp_info[:effective_date],
          currency: comp_info[:currency],
          pay_frequency: "annual",
          status: "active",
          notes: "Initial demo compensation package",
          created_by: admin
        )

        comp_info[:components].each do |comp|
          CompensationComponent.create!(
            tenant: tenant,
            compensation_record: rec,
            component_type: comp[:component_type],
            amount: comp[:amount],
            frequency: comp[:frequency]
          )
        end
      end

      tenant
    end

    def seed_benchmark!(tenant_name: "Globex Corporation", count: 10_000, batch_size: 2_500, force: false)
      Kernel.srand(DETERMINISTIC_SEED)

      tenant = Tenant.find_or_create_by!(name: tenant_name) do |t|
        t.status = "active"
      end

      # Check idempotency
      existing_count = Employee.where(tenant: tenant).count
      if existing_count == count && !force
        Rails.logger.info("BenchmarkSeed: #{tenant.name} already has #{existing_count} employees. Skipping.")
        return { tenant: tenant, count: existing_count, duration_seconds: 0.0 }
      end

      # Reset existing benchmark records if forcing or partially seeded
      if existing_count > 0
        CompensationComponent.where(tenant: tenant).delete_all
        CompensationRecord.where(tenant: tenant).delete_all
        Employee.where(tenant: tenant).delete_all
      end

      # Seed Admin & HR users for Benchmark Tenant
      admin = User.find_or_initialize_by(tenant: tenant, email: "admin@globex.com")
      admin.assign_attributes(
        password: "password123",
        role: "organization_admin",
        status: "active"
      )
      admin.save!

      hr = User.find_or_initialize_by(tenant: tenant, email: "hr@globex.com")
      hr.assign_attributes(
        password: "password123",
        role: "hr_manager",
        status: "active"
      )
      hr.save!

      # Seed domains
      domain_records = DOMAINS.map do |domain_name|
        Domain.find_or_create_by!(tenant: tenant, name: domain_name) { |d| d.status = "active" }
      end
      domain_map = domain_records.index_by(&:name)

      # Assign HR Manager to Engineering
      UserDomainAssignment.find_or_create_by!(
        tenant: tenant,
        user: hr,
        domain: domain_map["Engineering"]
      )

      start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      now = Time.current

      total_inserted = 0

      (1..count).each_slice(batch_size) do |slice|
        employee_rows = []
        metadata = []

        slice.each do |i|
          first_name = FIRST_NAMES.sample
          last_name = LAST_NAMES.sample
          domain_name = DOMAINS.sample
          domain_id = domain_map[domain_name].id
          locale_info = COUNTRIES_AND_CURRENCIES.sample
          country_code = locale_info[:country]
          currency = locale_info[:currency]
          job_title = JOB_TITLES[domain_name].sample
          status = STATUSES.sample
          emp_num = format("EMP-GLB-%05d", i)
          email = format("%s.%s.%05d@globex.com", first_name.downcase, last_name.downcase, i)
          hire_date = Date.new(2021, 1, 1) + rand(1..1400).days

          employee_rows << {
            tenant_id: tenant.id,
            domain_id: domain_id,
            employee_number: emp_num,
            first_name: first_name,
            last_name: last_name,
            email: email,
            country_code: country_code,
            job_title: job_title,
            employment_status: status,
            hire_date: hire_date,
            created_at: now,
            updated_at: now
          }

          metadata << {
            employee_number: emp_num,
            currency: currency,
            base_min: locale_info[:base_min],
            base_max: locale_info[:base_max],
            hire_date: hire_date,
            domain_name: domain_name
          }
        end

        # Bulk insert employees and retrieve assigned IDs
        inserted_emps = Employee.insert_all(
          employee_rows,
          returning: %i[id employee_number]
        )
        emp_id_by_number = inserted_emps.rows.to_h { |row| [row[1], row[0]] }

        # Build Compensation Records
        comp_record_rows = []
        comp_metadata = []

        metadata.each do |meta|
          emp_id = emp_id_by_number[meta[:employee_number]]
          comp_record_rows << {
            tenant_id: tenant.id,
            employee_id: emp_id,
            effective_date: meta[:hire_date],
            currency: meta[:currency],
            pay_frequency: "annual",
            status: "active",
            created_by_id: admin.id,
            notes: "Deterministic benchmark package",
            created_at: now,
            updated_at: now
          }

          comp_metadata << {
            emp_id: emp_id,
            currency: meta[:currency],
            base_min: meta[:base_min],
            base_max: meta[:base_max],
            domain_name: meta[:domain_name]
          }
        end

        inserted_comps = CompensationRecord.insert_all(
          comp_record_rows,
          returning: %i[id employee_id]
        )
        comp_id_by_emp_id = inserted_comps.rows.to_h { |row| [row[1], row[0]] }

        # Build Compensation Components
        component_rows = []

        comp_metadata.each do |comp_meta|
          comp_rec_id = comp_id_by_emp_id[comp_meta[:emp_id]]
          base_amount = BigDecimal((rand(comp_meta[:base_min]..comp_meta[:base_max]) / 1000 * 1000).to_s)

          component_rows << {
            tenant_id: tenant.id,
            compensation_record_id: comp_rec_id,
            component_type: "base_salary",
            amount: base_amount,
            frequency: "annual",
            created_at: now,
            updated_at: now
          }

          # 60% chance of bonus
          if rand < 0.6
            bonus_amount = (base_amount * BigDecimal(rand(5..20).to_s) / 100).round(2)
            component_rows << {
              tenant_id: tenant.id,
              compensation_record_id: comp_rec_id,
              component_type: "bonus",
              amount: bonus_amount,
              frequency: "annual",
              created_at: now,
              updated_at: now
            }
          end

          # Sales commissions
          if comp_meta[:domain_name] == "Sales & Marketing" && rand < 0.75
            comm_amount = (base_amount * BigDecimal(rand(15..35).to_s) / 100).round(2)
            component_rows << {
              tenant_id: tenant.id,
              compensation_record_id: comp_rec_id,
              component_type: "commission",
              amount: comm_amount,
              frequency: "annual",
              created_at: now,
              updated_at: now
            }
          end
        end

        CompensationComponent.insert_all(component_rows)
        total_inserted += employee_rows.size
      end

      end_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      duration = (end_time - start_time).round(3)

      Rails.logger.info("BenchmarkSeed: Inserted #{total_inserted} employees for #{tenant.name} in #{duration}s")

      {
        tenant: tenant,
        count: total_inserted,
        duration_seconds: duration
      }
    end
  end
end
