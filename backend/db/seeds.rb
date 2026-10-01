# frozen_string_literal: true

# Seeds for Development, Demo & Benchmark Environments

puts "== Seeding Demo Environment (Tenant 1: Acme Corporation) =="
acme = BenchmarkSeedService.seed_acme_demo!
puts "✅ Seeded Tenant: #{acme.name} (4 demo employees)"
puts "   Org Admin: admin@example.com (password: password123)"
puts "   HR Manager: hr@example.com (password: password123)"
puts "   Domains: Engineering, Sales & Marketing"

# Seed deterministic benchmark dataset (Tenant 2: Globex Corporation)
# Seeds 10,000 synthetic employees with compensation records and components across currencies
puts "\n== Seeding Deterministic Benchmark Dataset (Tenant 2: Globex Corporation) =="
benchmark_count = (ENV["BENCHMARK_COUNT"] || 10_000).to_i
force = ENV["FORCE_BENCHMARK_SEED"].to_s == "true"
result = BenchmarkSeedService.seed_benchmark!(tenant_name: "Globex Corporation", count: benchmark_count, force: force)
puts "✅ Seeded Tenant: #{result[:tenant].name} (#{result[:count]} employees in #{result[:duration_seconds]}s)"
puts "   Benchmark Admin: admin@globex.com (password: password123)"
puts "   Benchmark HR: hr@globex.com (password: password123)"
