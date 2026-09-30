FactoryBot.define do
  factory :tenant do
    sequence(:name) { |n| "Tenant #{n}" }
    status { "active" }
  end

  factory :user do
    tenant
    sequence(:email) { |n| "user#{n}@example.com" }
    password { "password123" }
    role { "hr_manager" }
    status { "active" }

    trait :admin do
      role { "organization_admin" }
    end

    trait :hr_manager do
      role { "hr_manager" }
    end
  end

  factory :domain do
    tenant
    sequence(:name) { |n| "Domain #{n}" }
    status { "active" }
  end

  factory :user_domain_assignment do
    tenant
    user
    domain
  end
end
