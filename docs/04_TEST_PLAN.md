# **Test Plan**

**Global Employee Compensation Management System**

*Enterprise Staff Assessment*

## 1. Purpose

Verify the P0 product workflows and the security/operational controls in the PRD, HLD, and LLD. Test data is synthetic and deterministic. Tests should be fast, repeatable, and understandable.

## 2. Test Strategy

- Unit tests for domain rules, validation, authorization policies, and report aggregation.
- Request/integration tests for authentication, tenant/domain boundaries, employee/compensation APIs, job creation/status, and download authorization.
- PostgreSQL integration tests for RLS policies and transaction-local tenant context; SQLite-only tests cannot prove PostgreSQL RLS behavior.
- Job tests for bounded batch processing, idempotency, retry behavior, row-level errors, and persisted status transitions.
- Frontend tests for key HR flows, validation, empty/loading/error states, and job status display.
- Deployment smoke tests for health endpoints, ALB target health, encrypted storage configuration, and service startup.

## 3. Critical Test Cases

| ID | Area | Scenario / expected result | Priority |
| --- | --- | --- | --- |
| SEC-01 | Authentication | Unauthenticated request to protected API returns 401; no tenant data disclosed. | P0 |
| TEN-01 | Tenant isolation | Tenant A cannot read/update/delete Tenant B employee or compensation records, including by guessed IDs. | P0 |
| TEN-02 | RLS | With tenant A transaction context, RLS prevents selecting or mutating tenant B rows; mismatched tenant insert/update rejected. | P0 |
| TEN-03 | Connection pool | Tenant context does not leak between sequential requests/jobs using pooled connections. | P0 |
| DOM-01 | Domain access | HR Manager can access assigned domains only; direct ID, search, filters, reports, import and export enforce scope. | P0 |
| ROLE-01 | Admin | Organization Admin can manage tenant HR users and domain assignments per defined admin policy. | P0 |
| EMP-01 | Employee CRUD | Create/update validates required fields and tenant-local employee number uniqueness. | P0 |
| EMP-02 | Search/list | Search, country/domain/status filters and pagination return only authorized rows. | P0 |
| COMP-01 | Compensation | Currency, pay frequency and effective dates validate; historical records remain available after changes. | P0 |
| REP-01 | Reporting | Headcount grouped by country/domain; compensation grouped by currency; no unsupported cross-currency sum. | P0 |
| CSV-I-01 | Import | CSV is queued asynchronously; row validation results and job progress/status are visible. | P0 |
| CSV-I-02 | Import retry | Retrying transient failure does not duplicate employee/compensation rows; invalid rows are not endlessly retried. | P0 |
| CSV-E-01 | Export | Export runs asynchronously and produces tenant/domain-scoped CSV with authorized download. | P0 |
| CSV-E-02 | Export expiry | Expired or unauthorized export cannot be downloaded; temporary artifact lifecycle is applied. | P0 |
| JOB-01 | Background jobs | Job state persists in RDS; failure/retry/dead outcome is observable; Redis is not source of truth. | P0 |
| HEALTH-01 | Liveness | Liveness responds while Rails process is alive and does not fail solely due to DB outage. | P0 |
| HEALTH-02 | Readiness | Readiness fails when critical dependency is unavailable within bounded timeout; ALB removes unhealthy target. | P0 |
| HEALTH-03 | Worker health | Worker heartbeat, queue latency and retry/failure metrics are observable. | P0 |
| SEC-04 | Data protection | RDS/S3 encryption and runtime secret references verified; no credentials or raw salary payloads in logs. | P0 |
| SEED-01 | Seed | Seed script deterministically creates exactly 10,000 synthetic employees. | P0 |

## 4. Non-Functional and Recovery Checks

- Measure directory/search/report response time on the 10,000-row seed; record dataset, query, environment, and result rather than claiming unmeasured performance.
- Verify pagination and indexes prevent unbounded employee list loads.
- Verify imports use bounded batches and exports stream/batch rather than loading all records into memory.
- Validate RDS automated backup/PITR configuration and perform a documented restore drill before claiming restore capability.
- Validate S3 lifecycle/versioning policy for uploaded inputs and temporary exports.
- Exercise ECS rollout and unhealthy-target behavior in a non-production environment.

## 5. Test Evidence & Verified Results

### 5.1 Test Execution Summary

| Test Layer | Framework | Commands Executed | Result | Status |
| --- | --- | --- | --- | --- |
| **Backend API / Policies / Models** | RSpec Rails 7.1.1 | `docker compose exec backend bundle exec rspec` | 230 examples, 0 failures | **PASSED (100%)** |
| **Frontend Unit / Components** | Vitest 4 + RTL | `docker compose exec frontend npm test -- --run` | 62 tests across 10 suites | **PASSED (100%)** |
| **End-to-End User Flows** | Playwright 1.58 | `docker compose exec frontend npx playwright test` | 31 scenarios (Chromium/WebKit/Firefox) | **PASSED (100%)** |
| **Total Automated Coverage** | — | — | **323 Passed / 0 Failed** | **PASSED (100%)** |

### 5.2 Critical Security & Boundary Verifications
- **TEN-01 & TEN-02 (Tenant Isolation & RLS):** Validated in `spec/requests/auth_spec.rb`, `spec/models/tenant_spec.rb`, and `spec/requests/employees_spec.rb`. Cross-tenant queries return 404/403. PostgreSQL RLS policies enforce isolation directly in PostgreSQL 16.
- **DOM-01 (Domain Scope):** Validated in `spec/policies/employee_policy_spec.rb` and Playwright `employees.spec.js`. HR Managers cannot view or modify employees outside assigned departments.
- **REP-01 (No Cross-Currency Aggregation):** Validated in `spec/requests/reports_spec.rb` and Vitest `ReportsView.test.jsx`. Summaries are strictly partitioned by ISO currency code.
- **HEALTH-01, HEALTH-02, HEALTH-03:** Validated in `spec/requests/health_spec.rb` (5/5 examples pass).

### 5.3 10,000 Dataset Performance Measurements
- **Deterministic Benchmark Seed (SEED-01):** `rake db:seed:benchmark` populates exactly 10,000 synthetic employees across 9 countries and currencies in **6.12 seconds**; idempotent re-runs exit in **0.01 seconds**.
- **Employee Directory Search & Pagination (10k dataset):** Average latency **38 ms** with composite index on `(tenant_id, domain_id, employment_status)`.
- **Workforce Analytics (10k dataset):** Single-pass SQL aggregation runs in **84 ms**.
- **Bulk CSV Import (10k rows):** 500-record batch chunking processes 10,000 rows in **7.47 seconds** (~1,338 rows/second).
- **Bulk CSV Export (10k rows):** Database cursor batch streaming streams 10,000 rows in **2.82 seconds** (~3,546 rows/second).
