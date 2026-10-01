FactoryBot.define do
  factory :export_job do
    tenant
    user
    filename { "employees_export_#{Time.current.strftime('%Y%m%d_%H%M%S')}.csv" }
    status { "queued" }
    filters { {} }
    total_rows { 0 }
    processed_rows { 0 }

    trait :processing do
      status { "processing" }
      started_at { Time.current }
      total_rows { 10 }
      processed_rows { 5 }
    end

    trait :completed do
      status { "completed" }
      started_at { 1.minute.ago }
      completed_at { Time.current }
      expires_at { 24.hours.from_now }
      total_rows { 10 }
      processed_rows { 10 }
    end

    trait :failed do
      status { "failed" }
      started_at { 1.minute.ago }
      completed_at { Time.current }
      error_message { "Export failed due to internal error" }
    end
  end
end
