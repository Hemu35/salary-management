# **Low-Level Design (LLD)**

**Global Employee Compensation Management System**

*Enterprise Assessment • Implemented Technical Design*

---

## 1. Purpose and Boundaries

This LLD provides low-level technical specifications for the implemented system, detailing tenant/domain authorization, PostgreSQL Row-Level Security (RLS), entity schemas, API endpoints, background worker batching, rollback mechanisms, and operational health checks.

---

## 2. Implemented Data Model

| Entity | Attributes & Types | Constraints & Purpose |
| --- | --- | --- |
| **Tenant** | `id: bigint`, `name: string`, `status: string`, `timestamps` | Top-level tenant boundary isolating all corporate data. |
| **User** | `id: bigint`, `tenant_id: bigint`, `email: string`, `password_digest: string`, `role: string` (`organization_admin`, `hr_manager`), `timestamps` | Scoped to tenant. Unique `(tenant_id, email)`. Passwords hashed with BCrypt. |
| **Domain** | `id: bigint`, `tenant_id: bigint`, `name: string`, `code: string`, `timestamps` | Department/domain within a tenant (e.g. Engineering, Sales, HR, Finance, Operations). |
| **UserDomainAssignment** | `id: bigint`, `tenant_id: bigint`, `user_id: bigint`, `domain_id: bigint` | Unique `(tenant_id, user_id, domain_id)`. Restricts HR Manager access to assigned domains. |
| **Employee** | `id: bigint`, `tenant_id: bigint`, `domain_id: bigint`, `employee_number: string`, `first_name: string`, `last_name: string`, `email: string`, `country_code: string`, `job_title: string`, `employment_status: string` (`active`, `on_leave`, `terminated`), `hire_date: date` | Unique `(tenant_id, employee_number)`. Indexes on `(tenant_id, domain_id, employment_status)` and search fields. |
| **CompensationRecord** | `id: bigint`, `tenant_id: bigint`, `employee_id: bigint`, `currency_code: string` (ISO-4217), `pay_frequency: string`, `effective_start_date: date`, `effective_end_date: date`, `base_amount: decimal(15,2)` | Effective-dated package history. Immutable historical records; active record has `effective_end_date = NULL`. |
| **CompensationComponent** | `id: bigint`, `tenant_id: bigint`, `compensation_record_id: bigint`, `component_type: string` (`bonus`, `commission`, `equity`, `allowance`), `name: string`, `amount: decimal(15,2)` | Components associated with a compensation record; currency matches parent record. |
| **ImportJob** | `id: bigint`, `tenant_id: bigint`, `user_id: bigint`, `file_key: string`, `status: string` (`queued`, `processing`, `completed`, `completed_with_errors`, `failed`, `cancelled`, `rolled_back`), `total_rows: integer`, `processed_rows: integer`, `success_rows: integer`, `error_rows: integer`, `row_errors: jsonb`, `rollback_metadata: jsonb` | Tracks async CSV import progress, row errors, and stores inserted IDs for atomic rollback. |
| **ExportJob** | `id: bigint`, `tenant_id: bigint`, `user_id: bigint`, `filters: jsonb`, `status: string` (`queued`, `processing`, `completed`, `failed`), `file_key: string`, `expires_at: datetime` | Tracks async CSV export progress and download availability (24-hour expiration). |

---

## 3. Tenant Context, RLS, and Authorization

### 3.1 Tenant Scoping & PostgreSQL RLS
All database interactions are protected by multi-layered isolation:
1. **Application Context:** Authenticated requests resolve `current_tenant` exclusively from the verified JWT payload. Client-supplied tenant IDs in request headers, query parameters, or body payloads are completely rejected.
2. **Transaction-Local Database Context:** The Rails `TenantScoped` concern wraps requests in an `ActiveRecord::Base.transaction` and executes:
   ```sql
   SET LOCAL app.current_tenant_id = '<current_tenant_id>';
   ```
   Because `SET LOCAL` is transaction-scoped, context never leaks across pooled database connections.
3. **PostgreSQL RLS Policies:**
   ```sql
   ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
   ALTER TABLE employees FORCE ROW LEVEL SECURITY;

   CREATE POLICY tenant_isolation_policy ON employees
     FOR ALL
     USING (tenant_id = current_setting('app.current_tenant_id', true)::bigint)
     WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::bigint);
   ```
   Identical policies are active on `compensation_records`, `compensation_components`, `domains`, `user_domain_assignments`, `users`, `import_jobs`, and `export_jobs`.

### 3.2 Role and Domain Authorization (Pundit Policies)
- **Organization Admin:** Full access across all domains within their tenant. Can create/edit employees, update compensation, view all reports, manage users, and assign domains.
- **HR Manager:** Strictly restricted to assigned domains (`user.domains`).
  - Search, list, and show endpoints return only employees belonging to assigned domains.
  - Attempting to access an employee in an unassigned domain returns `403 Forbidden` (`Pundit::NotAuthorizedError`).
  - Reports aggregate data only across assigned domains.
  - CSV imports reject rows belonging to unassigned domains.
  - CSV exports filter records to assigned domains.

---

## 4. API Contract

| Endpoint | Method | Scope / Auth | Request Payload / Params | Response Summary |
| --- | --- | --- | --- | --- |
| `/api/session` | `POST` | Public | `{ email, password }` | Authenticates user; returns `{ token, user: { id, email, role, domains: [...] }, tenant: { id, name } }`. |
| `/api/session` | `GET` | Authenticated | Header: `Bearer <token>` | Returns current user profile, role, tenant, and accessible domains. |
| `/api/session` | `DELETE` | Authenticated | Header: `Bearer <token>` | Destroys current session token. |
| `/api/employees` | `GET` | Tenant + Domain | `?page=1&per_page=25&query=...&domain_id=...&country=...&status=...` | Paginated employee list, total count, total pages, and active filter metadata. |
| `/api/employees` | `POST` | Tenant + Domain | `{ employee: { employee_number, first_name, last_name, email, domain_id, country_code, job_title, employment_status, hire_date } }` | Creates employee in authorized domain; returns created employee record. |
| `/api/employees/:id` | `GET` | Tenant + Domain | — | Returns full employee details and current active compensation. |
| `/api/employees/:id` | `PATCH` | Tenant + Domain | `{ employee: { ... } }` | Updates employee profile fields within authorized domain. |
| `/api/employees/:id/compensation` | `GET` | Tenant + Domain | — | Returns active compensation package and chronological history of revisions. |
| `/api/employees/:id/compensation` | `POST` | Tenant + Domain | `{ compensation: { currency_code, pay_frequency, base_amount, effective_start_date, components: [...] } }` | Creates new revision; sets previous package `effective_end_date`; returns new package. |
| `/api/employees/:id/compensation/:cid` | `PATCH` | Tenant + Domain | `{ compensation: { base_amount, pay_frequency, components: [...] } }` | Edits active compensation in-place without creating an extra historical record. |
| `/api/imports` | `POST` | Tenant + Domain | `multipart/form-data: { file: <csv> }` | Queues async import job; returns `{ id, status: "queued" }`. |
| `/api/imports/:id` | `GET` | Tenant | — | Returns progress (`processed_rows`, `total_rows`, `status`), and `row_errors` array. |
| `/api/imports/:id/cancel` | `POST` | Tenant | — | Cancels active import job and rolls back inserted rows. |
| `/api/imports/:id/rollback` | `POST` | Tenant | — | Rolls back completed import via `ImportRollbackService`, restoring previous compensation state. |
| `/api/exports` | `POST` | Tenant + Domain | `{ domain_id, country_code, status, employee_ids: [...] }` | Queues async export job; returns `{ id, status: "queued" }`. |
| `/api/exports/:id` | `GET` | Tenant | — | Returns export progress and status (`queued`, `processing`, `completed`). |
| `/api/exports/:id/download` | `GET` | Tenant + Domain | — | Re-authorizes requester and streams generated CSV artifact. |
| `/api/reports/workforce` | `GET` | Tenant + Domain | `?domain_id=...` | Returns headcount aggregated by country and by domain. |
| `/api/reports/compensation` | `GET` | Tenant + Domain | `?domain_id=...` | Returns compensation metrics (count, total, average, median, min, max) strictly partitioned by `currency_code`. |
| `/health/live` | `GET` | Public | — | Returns `{ status: "ok" }` for process liveness (no DB queries). |
| `/health/ready` | `GET` | Public | — | Returns `{ status: "ok", checks: { database: "ok", redis: "ok" } }` for ALB traffic readiness. |
| `/health/workers` | `GET` | Public | — | Returns `{ status: "ok", active_workers: N, processed: N, failed: N, queues: { ... } }` for Sidekiq health. |

---

## 5. High-Performance Bulk Processing Architecture

### 5.1 Asynchronous CSV Import Worker (`ImportJobWorker`)
Processes up to 10,000 records in under 8 seconds using bounded batch chunking:
```
CSV Upload (10k rows)
       │
       ▼
Read & Validate Header
       │
       ▼
Batch Chunks (BATCH_SIZE = 500)
       │
       ├─► 1. In-Memory Validation (Domain name, email regex, country code, status)
       ├─► 2. Prefetch Existing Records (Single SQL query for existing employee numbers/emails)
       ├─► 3. Bulk Insert Employees: PostgreSQL insert_all(..., returning: [:id, :employee_number])
       ├─► 4. Bulk Insert Compensation Records: insert_all(..., returning: [:id, :employee_id])
       ├─► 5. Bulk Insert Components: insert_all
       └─► 6. Single DB Transaction Per Batch (20 total transactions for 10k rows)
```
- **Performance:** 10,000 rows imported and indexed in **7.47 seconds** (~1,338 rows/sec).
- **Rollback Metadata:** Stores created employee IDs and superseded compensation IDs in `rollback_metadata` JSONB for atomic undo capability.

### 5.2 Asynchronous CSV Export Worker (`ExportJobWorker`)
- Uses database cursors (`batch_size: 1_000`) to stream records without loading the entire dataset into memory.
- Progress updates are throttled to every 250 records to prevent database write contention.
- Streams 10,000 records to CSV in **2.82 seconds** (~3,546 rows/sec).

---

## 6. Deterministic Benchmark Dataset (`BenchmarkSeedService`)

A dedicated service populates 10,000 synthetic employees deterministically using `srand(42)` in the `Globex Corporation` tenant:
- **Seed Execution:** `rake db:seed:benchmark COUNT=10000`
- **Execution Time:** **6.12 seconds** for 10,000 complete employee records with active compensation packages and components across 9 countries and currencies (`USD`, `EUR`, `GBP`, `CAD`, `AUD`, `SGD`, `JPY`, `INR`, `BRL`).
- **Idempotency:** Instant check (`count >= COUNT`) skips re-seeding in **0.01 seconds**.

---

## 7. Operational Health & Monitoring

| Check Endpoint | Purpose | Implemented Mechanism | Target Consumer |
| --- | --- | --- | --- |
| `GET /health/live` | Process Liveness | Checks that Rails process can respond; zero DB/Redis calls. | ECS container health check / Docker healthcheck |
| `GET /health/ready` | Dependency Readiness | `ActiveRecord::Base.connection.execute("SELECT 1")` + Redis ping with 2-second timeout. | Application Load Balancer (ALB) target group |
| `GET /health/workers` | Background Worker Health | `Sidekiq::ProcessSet.new.size`, `Sidekiq::Stats.new`, and `Sidekiq::Queue.new.latency`. | Prometheus / CloudWatch alarms / Operations |

---

## 8. Implementation Decisions Resolved

| Architecture Question | Resolution Implemented | Code Location |
| :--- | :--- | :--- |
| **Authentication Strategy** | Stateless JWT tokens with BCrypt password hashing; token carries user, tenant, role, and accessible domains. | `backend/app/controllers/concerns/authenticable.rb` |
| **Organization Admin Data Access** | Org Admin has tenant-wide access across all domains for company administration and reporting. HR Managers are strictly domain-scoped. | `backend/app/policies/employee_policy.rb` |
| **Multiple Domain Assignments** | Supported via `UserDomainAssignment` join model (`has_many :domains, through: :user_domain_assignments`). | `backend/app/models/user.rb` |
| **PostgreSQL RLS Configuration** | `SET LOCAL app.current_tenant_id` within transaction blocks; policies enforce `USING` and `WITH CHECK` for non-superuser role `app_user`. | `backend/db/migrate/20260930101500_enable_rls_on_tenant_tables.rb` |
| **Import Error & Rollback Handling** | Row-level validation failures captured in `row_errors` array; atomic cancellation and rollback implemented via `ImportRollbackService`. | `backend/app/services/import_rollback_service.rb` |
| **Health Check Separation** | Separated liveness (`/health/live`), readiness (`/health/ready`), and worker status (`/health/workers`). | `backend/app/controllers/health_controller.rb` |
