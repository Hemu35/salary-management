# frozen_string_literal: true

namespace :db do
  namespace :seed do
    desc "Seed deterministic 10k employee benchmark dataset"
    task benchmark: :environment do
      count = (ENV["COUNT"] || 10_000).to_i
      force = ENV["FORCE"].to_s == "true"
      puts "Starting deterministic benchmark seed (count: #{count}, force: #{force})..."
      result = BenchmarkSeedService.seed_benchmark!(count: count, force: force)
      puts "✅ Completed benchmark seed: #{result[:count]} employees created for #{result[:tenant].name} in #{result[:duration_seconds]}s"
    end
  end
end
