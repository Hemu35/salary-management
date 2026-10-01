FactoryBot.define do
  factory :import_job do
    tenant
    user
    filename { "employees_sample.csv" }
    file_path { "storage/imports/test_sample.csv" }
    status { "queued" }
    total_rows { 0 }
    processed_rows { 0 }
    successful_rows { 0 }
    failed_rows { 0 }
    error_summary { [] }

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
      total_rows { 10 }
      processed_rows { 10 }
      successful_rows { 10 }
    end

    trait :failed do
      status { "failed" }
      started_at { 1.minute.ago }
      completed_at { Time.current }
      error_summary { [{ "row" => 1, "errors" => ["File is corrupted or empty"] }] }
    end
  end
end
