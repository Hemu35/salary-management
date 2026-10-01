# **Architecture and Product Decision Log**

**Global Employee Compensation Management System**

*Enterprise Staff Assessment*

## Decision Register

| ID | Decision | Reason / trade-off | Status |
| --- | --- | --- | --- |
| D-01 | Multi-tenant SaaS; shared application serves multiple organizations. | One deployable product; requires strict tenant isolation. | Operational / Verified |
| D-02 | Shared Amazon RDS for PostgreSQL schema with tenant_id for MVP. | Cost/simple operations; logical isolation reinforced by RLS and application authorization. | Operational / Verified |
| D-03 | PostgreSQL RLS as defense in depth. | Database policies reduce impact of accidentally unscoped application queries. Implemented with `app.current_tenant_id` session setting in `ApplicationController` and `TenantContext` middleware. | Operational / Verified |
| D-04 | Tenant identity comes from authenticated identity/session, not browser tenant_id. | Prevents user-controlled tenant switching; verified via JWT claims and session context. | Operational / Verified |
| D-05 | Domain-scoped HR Manager access within tenant; Organization Admin manages users/assignments. | Supports multiple HR teams managing different employee populations without weakening tenant boundary. Implemented via Pundit policies and `hr_domain_assignments`. | Operational / Verified |
| D-06 | Support multiple countries and currencies in employee/compensation records. | Supports global product direction; no unsupported currency aggregation; reports grouped by currency. | Operational / Verified |
| D-07 | No FX conversion or statutory payroll calculations in MVP. | Requires rates, dates, jurisdictions and compliance rules beyond assessment scope. | Out of scope |
| D-08 | Rails modular monolith + React frontend. | Maintainable, fast assessment delivery; avoid premature service decomposition. | Operational / Verified |
| D-09 | React static build served from S3/CloudFront; Rails API behind ALB. | Avoids dedicated frontend compute; CDN delivers static assets. | Target design (Dockerized locally) |
| D-10 | ECS Fargate for Rails API and separately scalable Sidekiq workers. | Managed container runtime and independent web/worker scaling. | Target design (Dockerized locally) |
| D-11 | Sidekiq + Redis for async CSV jobs; no SQS/DLQ in MVP. | Sufficient job queue/retry/dead handling for current scope with fewer moving parts. | Operational / Verified |
| D-12 | CSV import and export are P0 and asynchronous. | Bulk work does not block HTTP requests; progress, row-level errors, and status visible via polling endpoints. | Operational / Verified |
| D-13 | RDS/S3 encryption with KMS; secrets in Secrets Manager/SSM; least-privilege IAM. | Sensitive employee/compensation data needs explicit data-protection controls. | Target design |
| D-14 | Separate liveness, readiness, and worker health checks. | `/health/live` (process alive, no DB), `/health/ready` (DB + Redis check for ALB routing), `/health/workers` (Sidekiq worker stats and queue latency). | Operational / Verified |
| D-15 | RDS automated backups/PITR and S3 recovery/lifecycle; restore drills. | Backups require tested restoration, not just configured snapshots. | Target design |
| D-16 | Dedicated or customer-managed database is a future isolation option, not MVP. | Supports enterprise isolation needs at additional routing, migration, secret, backup and operations cost. | Future option |
| D-17 | Organization Admin's access to employee/compensation records requires explicit policy. | Resolved: Admin has tenant-wide visibility across all departments/domains to manage users, assign domains, and oversee company-wide headcount/compensation. HR Managers remain strictly scoped to their assigned domains. | Operational / Verified |
| D-18 | Bounded Bulk Processing for CSV Import and Export. | Processing 10,000 CSV rows individually was slow (~14 minutes) due to N+1 queries and per-row transactions. Optimized with 500-record batch chunking, in-memory validation, pre-fetching domain/employee lookup maps, bulk `insert_all(..., returning: [...])`, and single transaction per batch. Reduced 10k import time to 7.47 seconds (100x speedup). Export optimized via database cursor batch streaming (1,000 rows/batch) down to 2.82 seconds. | Operational / Verified |
| D-19 | Deterministic 10,000 Benchmark Seed (`BenchmarkSeedService`). | Deterministically populates exactly 10,000 synthetic employees across 9 countries and currencies using `srand(42)` in a dedicated benchmark tenant (Globex Corporation). Keeps Acme Corporation clean for core demo/E2E workflows. Includes sub-second idempotency check (`db:seed:benchmark`). | Operational / Verified |

## Implementation Traceability

| Decision ID | Implementation Location | Verification Evidence |
| --- | --- | --- |
| D-01, D-02 | `backend/db/migrate/` | Tenant-scoped schema migrations; foreign key constraints |
| D-03 | `backend/db/migrate/20260930101500_enable_rls_on_tenant_tables.rb`, `backend/app/controllers/concerns/tenant_scoped.rb` | RLS specs in `spec/requests/` and `spec/models/` passing |
| D-04 | `backend/app/controllers/concerns/authenticable.rb` | JWT payload decodes `tenant_id` directly from user record |
| D-05, D-17 | `backend/app/policies/employee_policy.rb`, `backend/app/policies/compensation_record_policy.rb` | Pundit authorization specs passing across Admin and HR roles |
| D-06 | `backend/app/models/compensation_record.rb`, `backend/app/models/compensation_component.rb` | Currencies preserved; reports strictly grouped by currency |
| D-11, D-12 | `backend/app/workers/import_job_worker.rb`, `backend/app/workers/export_job_worker.rb` | Sidekiq 7 async workers with retry backoff and error tracking |
| D-14 | `backend/app/controllers/health_controller.rb` | `GET /health/live`, `/health/ready`, `/health/workers` tested in `spec/requests/health_spec.rb` |
| D-18 | `backend/app/workers/import_job_worker.rb`, `backend/app/workers/export_job_worker.rb` | Verified benchmark: 10k import in 7.47s; 10k export in 2.82s |
| D-19 | `backend/app/services/benchmark_seed_service.rb`, `backend/lib/tasks/benchmark_seed.rake` | `spec/services/benchmark_seed_service_spec.rb` passes; idempotent |
