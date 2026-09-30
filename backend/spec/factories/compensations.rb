FactoryBot.define do
  factory :compensation_record do
    tenant
    employee { association :employee, tenant: tenant }
    effective_date { Date.current }
    currency { "USD" }
    pay_frequency { "annual" }
    status { "active" }
    notes { "Standard compensation package" }

    trait :with_base_salary do
      after(:create) do |record|
        create(:compensation_component,
          tenant: record.tenant,
          compensation_record: record,
          component_type: "base_salary",
          amount: BigDecimal("120000.00"),
          frequency: "annual"
        )
      end
    end
  end

  factory :compensation_component do
    tenant
    compensation_record { association :compensation_record, tenant: tenant }
    component_type { "base_salary" }
    amount { BigDecimal("120000.00") }
    percentage { nil }
    frequency { "annual" }
  end
end
