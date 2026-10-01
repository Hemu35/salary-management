# **Test Plan**

**Global Employee Compensation Management System**

*Incubyte Assessment • Version 2.5*

## 1. Purpose

Verify the P0 product workflows and the security/operational controls in the v2.5 PRD, HLD, and LLD. Test data is synthetic and deterministic. Tests should be fast, repeatable, and understandable.

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
## 5. Test Evidence

Record test command, environment, commit SHA, result, date, and relevant sanitized logs/screenshots. Distinguish automated test evidence from configuration that is planned but not yet deployed.
