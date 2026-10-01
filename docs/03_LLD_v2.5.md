# **Low-Level Design (LLD)**

**Global Employee Compensation Management System**

*Incubyte Assessment • Version 2.5 • Target design, not deployment evidence*

## 1. Purpose and Boundaries

This LLD specifies implementation guidance for tenant/domain authorization, PostgreSQL RLS, database constraints, API behavior, background jobs, health checks, AWS security, backup/recovery, and tests. Exact environment values (retention, intervals, thresholds, sizing, RPO/RTO) must be decided and verified during deployment.

## 2. Data Model

| Entity | Key fields | Constraints / purpose |
| --- | --- | --- |
| Tenant | id, name, status, timestamps | Organization boundary. |
| User | id, tenant_id, email, password_digest or identity_subject, role, status | Roles: organization_admin, hr_manager; identity strategy to confirm. |
| Domain | id, tenant_id, name, status | Department/domain within tenant. |
| UserDomainAssignment | tenant_id, user_id, domain_id | Unique assignment; all referenced records same tenant. |
| Employee | id, tenant_id, domain_id, employee_number, names, email, country_code, job_title, status, hire_date | Tenant-owned; employee_number unique within tenant; domain belongs to tenant. |
| CompensationRecord | tenant_id, employee_id, currency_code, pay_frequency, effective_start/end, base_amount | Fixed precision money; preserve effective-dated history. |
| CompensationComponent | tenant_id, compensation_record_id, type, name, amount | Amount uses fixed precision and record currency. |
| ImportJob | tenant_id, requester_id, source_file_key, status, row counts, error_file_key, idempotency_key | Persisted job state and sanitized row errors. |
| ExportJob | tenant_id, requester_id, filters/scope, status, file_key, expires_at | Reauthorize status and download. |
| AuditEvent | tenant_id, actor_id, action, resource, request_id, redacted metadata, timestamp | Sensitive-action audit without secrets or raw compensation payloads. |

## 3. Tenant Context, RLS, and Domain Authorization

### 3.1 Request/job authorization sequence

Authenticate the user using the selected session/identity provider.

Resolve tenant_id from the trusted authenticated user record; never trust a browser-supplied tenant_id.

Authorize role and requested employee domain(s).

Scope Rails relations and every read/write/report/import/export operation to tenant and permitted domains.

For jobs, load persisted job metadata, validate tenant/requester/scope, then establish tenant context before querying data.

### 3.2 PostgreSQL RLS design

Enable RLS on tenant-owned tables (employees, compensation records/components, domains/assignments as appropriate, import/export jobs, audit events). Policies constrain rows using tenant_id and trusted transaction-local tenant context. Apply USING and WITH CHECK semantics to prevent unauthorized reads/updates/deletes and cross-tenant inserts.

- Use a runtime DB role without SUPERUSER or BYPASSRLS; avoid executing app queries as a table-owner role that bypasses policies. Consider FORCE ROW LEVEL SECURITY.
- Set tenant context transaction-locally (e.g., set_config with local=true) inside a transaction before protected queries. Transaction-local context avoids leakage across pooled connections.
- Ensure every tenant-scoped request/job wraps database work in the appropriate transaction; context must not persist across pooled connection reuse.
- Use separately controlled roles/procedures for migrations, seeding, and audited operational tasks.
- RLS is defense in depth; Rails tenant and domain authorization remains mandatory.
Illustrative policy predicate (adapt to actual schema and role setup):

USING (tenant_id = current_setting('app.current_tenant_id', true)::bigint) AND WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::bigint)

### 3.3 Domain-scoped access

- Organization Admin manages tenant users and domain assignments; define explicitly whether admin also has all employee-data access.
- HR Managers are restricted to assigned domain_id values within their tenant.
- Validate tenant consistency between users, domains, employees, compensation, and job records; use composite foreign keys/constraints where practical.
- Apply domain authorization to direct-ID requests, search, reports, import rows, export filters, job status, and downloads.
## 4. Database Integrity and Indexes

- Unique (tenant_id, employee_number); optionally unique (tenant_id,email) for users/employees according to identity policy.
- Unique (tenant_id,user_id,domain_id) for assignments; ensure domain and employee belong to same tenant.
- Indexes for employees: (tenant_id,domain_id), (tenant_id,country_code), (tenant_id,employment_status), plus indexes matching search patterns.
- Compensation index (tenant_id,employee_id,effective_start); effective_end must be >= effective_start; reject prohibited overlapping effective periods.
- Use NUMERIC/DECIMAL for money, ISO currency code, and explicit pay frequency; never floating-point amounts.
- Job indexes (tenant_id,status), idempotency key uniqueness within tenant, and export expiration lookup.
## 5. API Contract

| Endpoint | Authorization / behavior |
| --- | --- |
| POST/GET/DELETE /api/session | Login/current user/logout; tenant comes from authenticated identity. |
| GET/POST /api/employees; GET/PATCH /api/employees/:id | Tenant- and domain-scoped employee operations. |
| GET/POST /api/employees/:id/compensation | Verify employee access; preserve history and currency. |
| POST /api/imports; GET /api/imports/:id | Create/status only for authorized tenant and domain scope. |
| POST /api/exports; GET /api/exports/:id; GET /api/exports/:id/download | Persist permitted scope; reauthorize status/download; short-lived URL if used. |
| GET /api/reports/workforce; GET /api/reports/compensation | Tenant/domain scoped; group compensation by currency; no cross-currency summation. |

Allowlist sort/filter fields, cap pagination, return safe 401/403/404 errors, and never expose tenant_id as a user-controlled authorization parameter.

## 6. CSV Import and Export

### 6.1 Import

Authorize import and requested domains; validate type, size, headers, encoding, and structure.

Store input in a private S3 location; create persisted ImportJob with tenant, requester, scope, idempotency key, and queued status.

Enqueue only the persisted job ID. Worker reloads job metadata and verifies scope before processing.

Process bounded batches with row validation, deterministic duplicate/upsert behavior, and bounded DB transactions.

Persist row counts and sanitized errors; distinguish row-level validation failures from infrastructure failures.

Retry transient failures only; make retries idempotent and avoid duplicate employee/compensation records.

### 6.2 Export

Authorize export; validate filters and persist permitted domain scope.

Create ExportJob and enqueue its ID.

Worker reloads job, establishes RLS tenant context, and applies tenant/domain scopes.

Generate CSV in bounded batches and store in private S3 with tenant/job-associated key.

Mark status and expiry; on download, reauthorize and use a short-lived URL or controlled Rails streaming.

Apply S3 lifecycle/cleanup to temporary exports.

## 7. Sidekiq and Redis

- Use separate imports, exports, and default queues; tune concurrency based on measured database/Redis capacity.
- Persist job status in RDS; Redis is queue infrastructure, not the authoritative job record.
- State model: queued → processing → completed or failed; row validation errors may yield completed-with-errors.
- Use bounded retries for transient failures; deterministic validation errors should not retry indefinitely.
- Monitor queue depth/latency, worker heartbeat, duration, retry counts, and dead/failed jobs. No SQS/DLQ in MVP.
## 8. Health Checks and Availability

| Check | Purpose | Proposed behavior | Used by |
| --- | --- | --- | --- |
| GET /health/live | Process liveness | Fast response; no DB dependency | ECS container health / operations |
| GET /health/ready | Traffic readiness | Bounded check of critical dependencies, e.g. DB connectivity | ALB target group |
| ECS task health | Container state | Container health check and deployment grace settings | ECS scheduler |
| Sidekiq health | Worker capability | Heartbeat, queue latency, job failures/retries | CloudWatch/operations |

Keep liveness independent of database availability to avoid restart loops. Readiness checks must use strict timeouts and avoid expensive queries. Configure ALB interval, timeout, healthy/unhealthy thresholds, ECS health-check grace period, and deployment minimum/maximum healthy percentages per environment; record actual values in IaC and validate them with rollout/failure tests. Health endpoints must not disclose secrets or sensitive diagnostics.

## 9. KMS, Secrets, and IAM

- Enable RDS and S3 encryption at rest with KMS-managed keys; document key policies, grants, rotation approach, and recovery implications.
- Use TLS for browser/API and database connections where supported.
- Store DB credentials and application secrets in Secrets Manager or Parameter Store; inject references at runtime, never commit secret values.
- Use separate least-privilege ECS task roles for Rails and Sidekiq, limited to required secrets, S3 prefixes, KMS actions, and logging.
- Separate deployment/operator permissions from runtime permissions; avoid broad wildcard access.
- Ensure KMS key policies permit required runtime/service roles and define response to disabled or scheduled-for-deletion keys.
## 10. Backup and Recovery

- Configure RDS automated backup retention and PITR by environment; take snapshots before risky changes when appropriate.
- Define S3 versioning, lifecycle, and recovery policy for required uploaded/generated files; expire temporary exports.
- Document restore runbook: restore RDS to an isolated target, validate data and tenant boundaries, update configuration safely, and record results.
- Perform periodic restore drills; a backup is not validated until restoration is tested.
- Retain versioned ECR images and IaC; document redeployment and rollback.
- Agree RPO/RTO targets before treating them as commitments.
## 11. Observability and Audit

- Structured logs include request/correlation ID, safe tenant/actor identifiers, job ID, outcome, and duration; exclude credentials, raw salary data, and unnecessary PII.
- Propagate correlation IDs from API requests to Sidekiq jobs.
- Monitor API latency/errors, ECS task health/resources, RDS connections/CPU/storage, Redis memory/latency, queue depth/latency, job duration/retries/dead jobs, and S3 failures.
- Use CloudTrail for AWS API activity and application AuditEvent records for sensitive user actions.
- Distributed tracing (X-Ray or compatible instrumentation) is a production enhancement, not a blocker for local MVP.
## 12. Required Tests

- RLS isolation: tenant A cannot read/update/delete tenant B rows; mismatched tenant inserts/updates are rejected.
- Connection pool safety: requests/jobs switching tenant context cannot inherit stale context.
- Runtime DB role cannot bypass RLS; migration/admin access is separately controlled.
- Domain tests cover direct IDs, search, reports, import rows, export jobs, and downloads.
- Tenant tests cover employee/compensation/job/report/file access and altered tenant parameters.
- Health tests: liveness remains independent of DB outage; readiness fails on unavailable critical dependency; ALB excludes unhealthy targets in integration environment.
- Job tests: retries are idempotent, row errors are visible, terminal failures observable, and export download authorization/expiry enforced.
- Configuration checks verify RDS/S3 encryption, secret references, least-privilege IAM, and absence of sensitive data in logs.
## 13. Decisions to Confirm During Implementation

- Authentication provider/session design: Cognito, approved OIDC provider, or custom auth. Rails remains authoritative for authorization.
- Organization Admin employee-data access policy and whether HR users can hold multiple domain assignments.
- Exact RDS backup retention/PITR, S3 lifecycle, KMS key policy/rotation, ALB/ECS health-check thresholds, and environment sizing.
- RLS SQL, tenant-context mechanism, runtime/migration roles, and FORCE RLS behavior validated through PostgreSQL integration tests.
- RPO/RTO and restore drill cadence agreed with stakeholders.
