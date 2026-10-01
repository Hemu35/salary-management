# **High-Level Design (HLD)**

**Global Employee Compensation Management System**

*Incubyte Assessment • Version 2.5 • Implemented Architecture*

---

## 1. Purpose and Architecture Summary

This HLD describes the multi-tenant SaaS architecture for employee and compensation management across organizations, countries, and currencies. The application is implemented as a modular Ruby on Rails 7.2 API with a React 19 single-page application (Vite 8), asynchronous Sidekiq 7 workers backed by Redis 7, and PostgreSQL 16 with Row-Level Security (RLS) as defense in depth.

The architecture is containerized via Docker Compose for local development and testing, and maps directly to an AWS production topology (ECS Fargate, Amazon RDS for PostgreSQL, ElastiCache Redis, S3, CloudFront, and Application Load Balancer).

---

## 2. Architecture Principles

- **Strict Multi-Tenant Isolation:** One shared application serves multiple customer organizations (tenants); every business operation enforces tenant isolation at the application layer and at the database layer via PostgreSQL RLS.
- **Dual-Layer Authorization:** Within a tenant, Organization Admins manage users and company-wide records, while HR Managers are restricted to assigned employee domains/departments.
- **Modular Monolith:** Rails API handles core CRUD, authentication, authorization, and reporting; asynchronous Sidekiq workers handle bulk workflows (CSV imports/exports) and can scale independently.
- **High-Speed Bounded Bulk Workflows:** Bulk CSV operations process data in bounded chunks (500 records/batch for imports, 1,000 records/batch cursor streaming for exports), achieving sub-10-second processing for 10,000 records.
- **Transactional Rollback & Cancellation:** Import jobs support in-flight cancellation and post-completion rollback via `ImportRollbackService` with persisted rollback metadata.
- **Strict Multi-Currency Separation:** Support for multi-country and multi-currency records without cross-currency summation or unsupported FX conversions.
- **Comprehensive Operational Health Checks:** Distinct liveness (`/health/live`), readiness (`/health/ready`), and worker health (`/health/workers`) signals.

---

## 3. Logical and Deployment Components

| Layer | Component | Implementation / Technology | Responsibility |
| --- | --- | --- | --- |
| **Client** | React Web Application | React 19, Vite 8, TailwindCSS 4 | Responsive HR dashboard: employee/compensation management, search/filters, domain switcher, reporting charts, CSV import/export modals. |
| **Edge & CDN** | Route 53 + CloudFront + S3 | AWS S3 / CloudFront (Dockerized in dev) | Static asset delivery; S3 origin access restricted to CloudFront. |
| **Security & Ingress** | AWS WAF + ALB | ALB / Nginx (Docker network in dev) | Web filtering, TLS termination, routing API requests to healthy Rails targets. |
| **Identity & Auth** | JWT + BCrypt | Rails Session Controller + JWT | Stateless token authentication; derives tenant context and serialized accessible domains from trusted database record. |
| **Application API** | Rails API on ECS Fargate | Ruby 3.3.0, Rails 7.2.1 (API mode) | Business logic, Pundit authorization, tenant context scoping, reporting, job dispatching. |
| **Background Processing** | Sidekiq + Redis | Sidekiq 7.3.9, Redis 7-alpine | Asynchronous CSV import/export, batch processing, retries, cancellation, and rollback execution. |
| **Data Persistence** | Amazon RDS for PostgreSQL | PostgreSQL 16-alpine | Shared schema with `tenant_id` partitioning; PostgreSQL Row-Level Security (RLS) defense in depth. |
| **File Storage** | Amazon S3 / ActiveStorage | Local filesystem / S3 | CSV upload storage, generated export artifacts, and temporary file lifecycle management. |
| **Health & Monitoring** | Health Controller + Sidekiq API | Rails Controller + `sidekiq/api` | Liveness, readiness, and Sidekiq worker inspection (`/health/live`, `/health/ready`, `/health/workers`). |

---

## 4. Request and Data Flows

```
[User Browser]
       │
       ▼ (HTTPS)
 [Route 53 DNS]
       │
       ├─────────────────────────────────┐
       ▼ (Static Assets)                 ▼ (API Requests)
[CloudFront CDN]                  [AWS WAF + ACM TLS]
       │                                 │
       ▼                                 ▼
[S3 Bucket] (React Build)         [Application Load Balancer]
                                         │
                                         ▼ (HTTP / Health Checks)
                                 [Rails API on ECS Fargate]
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
            [PostgreSQL 16 Database]           [Redis 7 Queue]
             (Shared Schema + RLS)                       │
                         ▲                               ▼
                         └─────────────── [Sidekiq Workers on ECS]
```

### 4.1 Frontend and API Traffic Flow
1. User loads the React single-page application (static build).
2. User authenticates via `POST /api/session`; backend validates credentials with `BCrypt` and returns a signed JWT containing `user_id`, `tenant_id`, `role`, and assigned `domains`.
3. Subsequent requests provide the JWT in the `Authorization: Bearer <token>` header.
4. Rails `TenantScoped` concern establishes the tenant context and executes `SET LOCAL app.current_tenant_id = ?` within a database transaction.
5. Pundit policies enforce role and domain-level authorization before executing queries.
6. Responses return tenant-isolated data. Sensitive credentials and raw compensation amounts are filtered from application logs.

### 4.2 Asynchronous CSV Import Flow (Optimized with Batching & Rollback)
1. User uploads a CSV file through the UI modal (`POST /api/imports`).
2. Rails validates the file structure and creates an `ImportJob` record with `status: :queued`.
3. The job ID is enqueued to Sidekiq (`ImportJobWorker`).
4. The worker establishes RLS tenant context, reads the file in **500-record chunks**, and performs:
   - In-memory validation (domains, email format, country codes, status).
   - Single-query prefetching of existing employees.
   - Bulk insertion via PostgreSQL `insert_all(..., returning: [...])` for employees, compensation records, and components.
   - Live progress updates persisted to the database.
5. If the user cancels the job mid-flight (`POST /api/imports/:id/cancel`), the worker terminates processing and rolls back inserted rows.
6. If the user requests a rollback after completion (`POST /api/imports/:id/rollback`), `ImportRollbackService` safely deletes all created records and restores previous compensation states using stored `rollback_metadata`.

### 4.3 Asynchronous CSV Export Flow (Cursor Streaming)
1. User requests an export with optional filters or selected employee IDs (`POST /api/exports`).
2. Rails creates an `ExportJob` with `status: :queued` and enqueues `ExportJobWorker`.
3. The worker queries records using database cursors (`batch_size: 1_000`) to avoid memory bloat.
4. Rows are streamed directly to a CSV artifact in private storage.
5. User polls `GET /api/exports/:id` for progress; when `completed`, downloads the file via authorized endpoint `GET /api/exports/:id/download`.

---

## 5. Multi-Tenancy and Authorization

### Shared Schema with Row-Level Security (RLS)
The database uses a shared schema with `tenant_id` columns on all tenant-owned tables (`employees`, `compensation_records`, `compensation_components`, `domains`, `user_domain_assignments`, `users`, `import_jobs`, `export_jobs`).

**Defense in Depth:**
- **Layer 1 (Application):** Rails `TenantScoped` controller concern scopes all ActiveRecord queries to `current_tenant`.
- **Layer 2 (Authorization):** Pundit policies enforce role (Admin vs. HR) and domain boundaries (`hr_domain_assignments`).
- **Layer 3 (Database RLS):** PostgreSQL RLS policies enforce `USING (tenant_id = current_setting('app.current_tenant_id', true)::bigint)` and `WITH CHECK`. Unscoped queries cannot leak or modify cross-tenant records.

### Domain-Scoped HR Manager Access
- **Organization Admin:** Full administrative visibility across all departments/domains within their tenant. Can manage users, assign domains, and oversee company-wide headcount and compensation.
- **HR Manager:** Strictly restricted to assigned domains. An HR Manager assigned to "Engineering" cannot view, search, export, or import records for "Sales" or "Marketing".

---

## 6. Availability, Health Checks, and Scaling

- **Liveness (`GET /health/live`):** Returns HTTP 200 `{ status: "ok" }` if the Rails application process is running. Performs no database queries to prevent cascading restarts during transient DB disconnects.
- **Readiness (`GET /health/ready`):** Returns HTTP 200 `{ status: "ok", checks: { database: "ok", redis: "ok" } }` only if both PostgreSQL and Redis respond within a bounded timeout. Used by the ALB target group to route traffic only to ready containers.
- **Worker Health (`GET /health/workers`):** Inspects Sidekiq using `Sidekiq::ProcessSet` and `Sidekiq::Stats`, reporting active worker count, processed/failed job counts, and queue latencies.
- **Independent Horizontal Scaling:** Rails API web containers and Sidekiq worker containers scale independently based on CPU/memory and queue depth.

---

## 7. Data Protection, Backup, and Recovery

- **Encryption at Rest & Transit:** KMS-managed keys for database and file storage in AWS; TLS 1.3 enforced for all web and API traffic.
- **Zero Credential Logging:** Passwords, tokens, and raw compensation data are filtered from Rails logs (`config.filter_parameters`).
- **Database Backup & Recovery (Target AWS):** RDS automated snapshots with 35-day retention and 5-minute Point-In-Time Recovery (PITR).
- **Temporary Artifact Lifecycle:** S3 lifecycle rules automatically delete generated export CSVs and temporary error reports after 24 hours.
- **Worker Idempotency:** Background jobs are idempotent; retrying an interrupted batch does not duplicate records.

---

## 8. Observability and Audit

- **Structured Logging:** Request and correlation IDs are attached to each HTTP request and propagated into background Sidekiq jobs.
- **Audit Trails:** Sensitive changes (employee creation, compensation updates, import rollbacks) record actor ID, action, timestamp, and affected resource IDs.
- **Queue Latency Metrics:** Sidekiq queue depth and latency monitored via `/health/workers`.

---

## 9. Key Trade-Offs and Architecture Decisions

| Decision | Rationale / Trade-Off | Status |
| :--- | :--- | :--- |
| **Rails Modular Monolith** | Rapid development, clear boundaries, and high test velocity for assessment without distributed microservice overhead. | Operational / Verified |
| **PostgreSQL RLS Defense in Depth** | Eliminates accidental cross-tenant data leakage from unscoped queries without requiring multi-database complexity. | Operational / Verified |
| **Bounded Bulk Batch Processing (D-18)** | 500-record batch chunking, in-memory validation, and `insert_all` reduced 10k CSV import time from 14 minutes to 7.47 seconds. | Operational / Verified |
| **Deterministic 10k Benchmark Dataset (D-19)** | `BenchmarkSeedService` populates 10,000 synthetic employees deterministically using `srand(42)` in 6.12s for load verification. | Operational / Verified |
| **Import Cancellation & Rollback** | In-flight cancellation and transactional rollback service (`ImportRollbackService`) prevent partial data pollution. | Operational / Verified |
| **Strict Multi-Currency Separation** | Multi-currency compensation records are supported natively; cross-currency summation is strictly prohibited without explicit FX rates. | Operational / Verified |
| **Dedicated Health Check Endpoints (D-14)** | Decouples process liveness (`/health/live`) from dependency readiness (`/health/ready`) and worker health (`/health/workers`). | Operational / Verified |

---

## 10. Out of Scope

- **Payroll Execution & Disbursement:** The system manages HR compensation records and budgets; statutory payroll disbursement and tax withholding integrations are outside assessment scope.
- **Foreign Exchange (FX) Conversion:** No consolidated single-currency totals are generated without an integrated FX rate feed.
- **Customer-Managed Databases:** Future option for high-tier enterprise clients; MVP uses shared schema with RLS.
