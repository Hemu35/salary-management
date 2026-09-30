FactoryBot.define do
  factory :employee do
    tenant
    domain { association :domain, tenant: tenant }
    sequence(:employee_number) { |n| "EMP%04d" % n }
    first_name { "Jane" }
    last_name { "Doe" }
    sequence(:email) { |n| "jane.doe#{n}@example.com" }
    country_code { "US" }
    job_title { "Software Engineer" }
    employment_status { "active" }
    hire_date { Date.current - 1.year }
  end
end
