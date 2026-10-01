# **AI Usage Log**

**Global Employee Compensation Management System**

*Incubyte Assessment • Version 2.5 • AI Collaboration Record*

## Purpose
This document records transparent AI assistance throughout the development of the Global Employee Compensation Management System, in accordance with the Incubyte assessment guidelines. Every AI-assisted code suggestion, architecture proposal, and test structure was independently reviewed, validated against specifications, and subjected to automated testing before acceptance.

---

## AI Collaboration Register

### Entry 1: Architecture Baseline & Requirements Structuring (Milestone 0)
| Field | Record |
| --- | --- |
| **Date / Milestone** | 2026-09-30 • Milestone 0 |
| **Tool / Model** | Antigravity AI Assistant (Gemini 2.5 Pro) |
| **Task / File / Area** | Requirements synthesis, ADR registration, HLD/LLD definitions (`docs/01_PRD_v2.5.md`, `docs/02_HLD_v2.5.md`, `docs/03_LLD_v2.5.md`, `docs/07_DECISION_LOG_v2.5.md`) |
| **Prompt Summary** | Analyze Incubyte assessment requirements for multi-tenant employee compensation system. Define architecture boundaries, strict non-requirements (no statutory payroll or FX math), and ADRs. |
| **Output Used** | Structured decision log (D-01 to D-17), layered architecture diagram specifications, and non-functional requirements. |
| **Output Rejected / Modified** | Rejected suggestion to include dynamic FX currency conversion service or SQS/DLQ queues to avoid unnecessary complexity and keep scope strictly aligned with P0. |
| **Human Review Performed** | Verified that multi-tenancy enforces server-side session identity and that domain-scoped access for HR Managers is explicitly decoupled from tenant isolation. |
| **Tests / Validation Run** | Requirements cross-checked against Incubyte evaluation rubric. |
| **Security / Privacy Review** | Ensured no production secrets, tokens, or personal identifiers are stored in architecture or prompt definitions. |
| **Follow-up / Limitations** | PostgreSQL RLS marked as defense in depth to be validated against actual PostgreSQL engine (not SQLite). |

---

### Entry 2: Foundation, Multi-Tenancy & PostgreSQL RLS (Milestone 1)
| Field | Record |
| --- | --- |
| **Date / Milestone** | 2026-09-30 • Milestone 1 |
| **Tool / Model** | Antigravity AI Assistant (Gemini 2.5 Pro) |
| **Task / File / Area** | Tenant resolution, JWT authentication, PostgreSQL RLS migrations, Pundit policies (`backend/app/controllers/concerns/tenant_scoped.rb`, `backend/db/migrate/20260930101500_enable_rls_on_tenant_tables.rb`) |
| **Prompt Summary** | Implement PostgreSQL RLS policies with transaction-local tenant context (`app.current_tenant_id`) and safe connection pool release for Rails 7.2 API. |
| **Output Used** | Migration enabling RLS with `USING (tenant_id = current_setting('app.current_tenant_id', true)::bigint)` and `TenantScoped` controller concern wrapping requests in transaction-local settings. |
| **Output Rejected / Modified** | Modified initial suggestion that set session variables globally across database connections; replaced with `SET LOCAL app.current_tenant_id` inside an `ActiveRecord::Base.transaction` block to prevent tenant context leaking across pooled connections. |
| **Human Review Performed** | Audited database role permissions: verified that default migration roles and app connection roles respect RLS policies and cannot bypass checks. |
| **Tests / Validation Run** | Executed RSpec tenant isolation specs (`spec/requests/auth_spec.rb`, `spec/models/tenant_spec.rb`). 100% pass on PostgreSQL 16. |
| **Security / Privacy Review** | Verified JWT payload validation: tenant ID is extracted directly from DB user record, never accepted from request query/body parameters. |
| **Follow-up / Limitations** | Sidekiq workers also require an explicit tenant context setter before running jobs. |

---

### Entry 3: Core Employee & Effective-Dated Compensation Records (Milestone 2)
| Field | Record |
| --- | --- |
| **Date / Milestone** | 2026-09-30 • Milestone 2 |
| **Tool / Model** | Antigravity AI Assistant (Gemini 2.5 Pro) |
| **Task / File / Area** | Employee CRUD, domain filtering, compensation records with historical timeline (`backend/app/models/compensation_record.rb`, `frontend/src/components/EmployeeTable.jsx`) |
| **Prompt Summary** | Create effective-dated compensation records with nested components. Ensure old records are preserved and cannot overlap in effective dates. Build React directory with pagination and debounce search. |
| **Output Used** | Model validations for dates, currency matching across components, and frontend modal for creating compensation revisions. |
| **Output Rejected / Modified** | Fixed an initial edge case where updating compensation modified existing historical records in-place; corrected to create a new effective-dated record and close out the previous record's `effective_end_date`. |
| **Human Review Performed** | Checked that all money calculations utilize `BigDecimal` / SQL `NUMERIC(15,2)` rather than floating-point math to prevent rounding errors. |
| **Tests / Validation Run** | 68 backend specs + 22 frontend Vitest component tests passing. |
| **Security / Privacy Review** | Confirmed domain-scoped authorization: HR Managers receive 403 Forbidden if attempting to read or modify employees in domains they are not assigned to. |
| **Follow-up / Limitations** | None. |

---

### Entry 4: Asynchronous CSV Import/Export & 100x Performance Optimization (Milestone 3 & 4)
| Field | Record |
| --- | --- |
| **Date / Milestone** | 2026-10-01 • Milestone 3 & 4 |
| **Tool / Model** | Antigravity AI Assistant (Gemini 2.5 Pro) |
| **Task / File / Area** | CSV Import and Export Sidekiq workers (`backend/app/workers/import_job_worker.rb`, `backend/app/workers/export_job_worker.rb`) |
| **Prompt Summary** | Optimize CSV import worker for 10,000 records. Initial row-by-row ActiveRecord approach took ~14 minutes (85 seconds per 1,000 rows). Reduce execution time to under 15 seconds. |
| **Output Used** | Bounded batching architecture (`BATCH_SIZE = 500`), in-memory regex and domain validation, bulk `insert_all` with `returning: [...]` to capture generated IDs, and single transaction per batch. Database cursor streaming for exports. |
| **Output Rejected / Modified** | Initial AI suggestion attempted raw SQL string concatenation for bulk inserts; modified to use Rails 7 `insert_all` with sanitized hash attributes to maintain SQL injection safety and audit trail timestamps. |
| **Human Review Performed** | Verified that batching correctly rolls back the failed batch without aborting the entire 10,000-row file, and properly records row-level errors in `row_errors` array. |
| **Tests / Validation Run** | Benchmarked in Docker: 10,000 rows imported in **7.47 seconds** (down from 14 minutes). Export of 10,000 rows reduced to **2.82 seconds**. Full worker specs passing. |
| **Security / Privacy Review** | Uploaded files stored in private directory; exported files generated with unique tokens and restricted download endpoints. |
| **Follow-up / Limitations** | Added `*.csv` to `.gitignore` to prevent large test files from polluting Git history. |

---

### Entry 5: Deterministic 10k Benchmark Seed & Workforce Analytics (Milestone 4)
| Field | Record |
| --- | --- |
| **Date / Milestone** | 2026-10-01 • Milestone 4 |
| **Tool / Model** | Antigravity AI Assistant (Gemini 2.5 Pro) |
| **Task / File / Area** | Deterministic seed generator and workforce analytics (`backend/app/services/benchmark_seed_service.rb`, `backend/app/controllers/api/v1/reports_controller.rb`) |
| **Prompt Summary** | Generate exactly 10,000 synthetic employees deterministically using `srand(42)` across 9 countries and currencies in a dedicated benchmark tenant (Globex Corporation). Create compensation summaries grouped strictly by currency. |
| **Output Used** | `BenchmarkSeedService` utilizing bulk chunked inserts (completes in 6.12 seconds), rake task `db:seed:benchmark`, and SQL aggregation grouped by currency for analytics. |
| **Output Rejected / Modified** | Strongly rejected any conversion or summation of different currencies into a single total; analytics strictly partitions metrics by `currency_code` (`USD`, `EUR`, `GBP`, etc.). |
| **Human Review Performed** | Verified idempotency: running `rake db:seed:benchmark` a second time detects existing benchmark records and exits in 0.01 seconds without duplicating data. |
| **Tests / Validation Run** | Added `spec/services/benchmark_seed_service_spec.rb` (verified exact 10,000 count); verified report queries run in 84ms on 10,000 rows. |
| **Security / Privacy Review** | All generated names, emails, and salaries are synthetic and deterministic. |
| **Follow-up / Limitations** | Updated E2E cleanup scripts to avoid wiping out Globex Corporation during Acme Corporation test teardowns. |

---

### Entry 6: Operational Health Endpoints & Test Suite Hardening (Milestone 5)
| Field | Record |
| --- | --- |
| **Date / Milestone** | 2026-10-01 • Milestone 5 |
| **Tool / Model** | Antigravity AI Assistant (Gemini 2.5 Pro) |
| **Task / File / Area** | Production health checks (`backend/app/controllers/health_controller.rb`, `backend/spec/requests/health_spec.rb`, Playwright E2E suite) |
| **Prompt Summary** | Implement Kubernetes/ALB compliant health checks: separate liveness (`/health/live`), readiness (`/health/ready`), and worker status (`/health/workers`). Fix test isolation issues in E2E tests. |
| **Output Used** | Rails health controller utilizing `Sidekiq::ProcessSet`, `Sidekiq::Stats`, and database ping; updated Playwright test isolation queries scoped by tenant ID. |
| **Output Rejected / Modified** | Fixed missing `require "sidekiq/api"` which initially caused `NameError` in production worker health check. |
| **Human Review Performed** | Confirmed `/health/live` returns HTTP 200 even if the database is temporarily unreachable, preventing cascading container restart loops. |
| **Tests / Validation Run** | 5 request specs in `health_spec.rb` passing. 31/31 Playwright E2E tests passing with 0 flakes. Total suite: 323 passing. |
| **Security / Privacy Review** | Health endpoints expose operational status and latencies without leaking database connection credentials or internal topology secrets. |
| **Follow-up / Limitations** | Ready for Milestone 6 documentation review and submission wrap-up. |

---

## Review Checklist Summary
- [x] **No Secrets or PII in Prompts:** All prompts referenced generic architectural patterns and synthetic schemas.
- [x] **Independent Code & Security Review:** All AI suggestions inspected for tenant boundary leakage, SQL injection safety, and transaction boundaries.
- [x] **100% Test Validation:** Every generated or refactored component backed by automated RSpec, Vitest, or Playwright tests.
- [x] **Transparent Decision Tracking:** Key decisions and trade-offs recorded in `docs/07_DECISION_LOG_v2.5.md`.
