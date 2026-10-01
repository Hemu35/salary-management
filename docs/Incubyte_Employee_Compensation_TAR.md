# **Technical Architecture Review (TAR)**

**Global Employee Compensation Management System**

*Assessment architecture baseline • Implemented Architecture*

---

## 1. Purpose and Scope

This document explains the architecture for a multi-tenant SaaS application that enables organizations to manage employee and compensation records across countries and currencies. It includes the architecture topology, major components, request and data flows, security boundaries, operational considerations, and future options.

The target design has been implemented, containerized via Docker Compose, and verified against 323 automated tests.

---

## 2. Architecture Design

The diagram below is the visual architecture baseline:
- See `docs/architecture_diagram.png` for topology diagram.

---

## 3. Architecture Overview

Multiple organizations use the same application instance while tenant-level controls isolate their records. Within each tenant, domain-scoped authorization restricts HR users to permitted employee groups, while Organization Admins maintain company-wide visibility and administration. The platform natively supports multi-country and multi-currency compensation records without unsupported cross-currency aggregation or FX conversion.

---

## 4. Layer-by-Layer Explanation

### 4.1 Client Layer
HR users from multiple organizations access the responsive React 19 single-page application built with Vite 8 and styled with TailwindCSS 4. Each user is authenticated via JWT and associated with a tenant and authorized domains.

### 4.2 Edge & Security Layer
Route 53 provides DNS. CloudFront delivers React static assets from S3. AWS WAF protects the web/API entry point. ACM provides TLS certificates. API requests route through the Application Load Balancer (ALB) to healthy Rails API tasks, governed by `/health/ready` target health checks.

### 4.3 Application Layer
React presents employee directory, compensation history, search/filters, analytics, and CSV workflows. The Ruby on Rails 7.2 API implements business logic, JWT authentication, Pundit authorization, tenant resolution, domain access checks, CRUD, reporting, and background job creation. Rails runs on ECS Fargate across Availability Zones. Sidekiq 7 runs as a separate ECS service for long-running CSV imports/exports. Redis 7 backs Sidekiq queues.

### 4.4 Data Layer
Amazon RDS for PostgreSQL 16 is the shared relational database using a shared schema and `tenant_id` logical separation. PostgreSQL Row-Level Security (RLS) is active on all tenant-owned tables (`USING (tenant_id = current_setting('app.current_tenant_id', true)::bigint)` and `WITH CHECK`). S3 stores uploaded CSV files and generated export artifacts with tenant-scoped access.

### 4.5 Security & Configuration
TLS in transit, KMS-managed encryption at rest, AWS Secrets Manager for secrets, and least-privilege IAM roles. Passwords are hashed with BCrypt. Credentials and raw salary payloads are filtered from logs.

### 4.6 Deployment & Infrastructure
ECR stores versioned Rails/Sidekiq images; ECS Fargate runs services. Git stores application and infrastructure-as-code definitions. CloudWatch provides logs/metrics, and health endpoints (`/health/live`, `/health/ready`, `/health/workers`) expose operational status.

---

## 5. Request and Data Flows

### 5.1 Standard API Request
1. Browser loads React static assets from S3 through CloudFront.
2. Browser sends API request with JWT header `Authorization: Bearer <token>` to ALB.
3. ALB routes request to a healthy Rails API task.
4. Rails authenticates the token, resolves tenant context, sets `app.current_tenant_id` locally in the database transaction, and applies Pundit authorization policies.
5. Rails executes tenant- and domain-scoped queries in PostgreSQL and returns the response.

### 5.2 CSV Import Background Flow (Bounded Batching & Rollback)
1. Rails validates the uploaded CSV file and creates an `ImportJob` record with `queued` status.
2. Rails enqueues the job ID to Sidekiq (`ImportJobWorker`).
3. Sidekiq worker processes records in **500-row chunks** with in-memory validation, single-query prefetching, and PostgreSQL bulk `insert_all(..., returning: [...])`. 10,000 rows import in **7.47 seconds**.
4. The worker persists progress, row-level errors, and rollback metadata.
5. If cancelled or rolled back by the user, `ImportRollbackService` removes created records and restores previous compensation states atomically.

### 5.3 CSV Export Background Flow (Cursor Streaming)
1. User queues an export with optional filters or selected employee IDs (`ExportJobWorker`).
2. Worker streams records in **1,000-row batches** via database cursors directly into a CSV artifact. 10,000 rows stream in **2.82 seconds**.
3. User polls status and downloads the file via authorized endpoint `GET /api/exports/:id/download`.

---

## 6. Tenant Isolation and Enterprise Database Options

The primary multi-tenant model is a shared PostgreSQL 16 schema with `tenant_id` columns, reinforced by PostgreSQL Row-Level Security (RLS) as defense in depth. Domain-scoped access applies within an organization and does not replace tenant isolation.

Future enterprise options include a dedicated SaaS-managed database per customer or a customer-managed database, which can be connected via Rails multi-database configurations.

---

## 7. Backup, Recovery, and Availability

- **Source Recovery:** Remote Git repository with semantic micro-commits and setup documentation.
- **Container Recovery:** Versioned container images for automated redeployment and rollback.
- **Database Recovery:** RDS automated backups with 35-day retention and 5-minute PITR.
- **File Recovery & Lifecycle:** S3 versioning with 24-hour expiration for temporary export CSVs.
- **Availability:** Multi-AZ deployment behind ALB; separate `/health/live` and `/health/ready` endpoints prevent false restart loops during transient DB blips.
- **Background Jobs:** Idempotent Sidekiq jobs with exponential backoff and dead-job inspection via `/health/workers`.

---

## 8. Observability and Operational Safeguards

- Structured JSON logs with request/correlation IDs propagated into Sidekiq workers.
- Sensitive parameters (`password`, `token`, `base_amount`, `amount`) filtered from application logs.
- Dedicated health check endpoints:
  - `GET /health/live`: Process liveness check.
  - `GET /health/ready`: DB + Redis dependency readiness check.
  - `GET /health/workers`: Sidekiq queue depth, worker count, latency, and failure metrics.

---

## 9. Scope Boundaries and Assumptions

- Multi-country and multi-currency records supported natively; zero unsupported cross-currency summation.
- Payroll execution/disbursement and statutory tax calculations are out of scope.
- Dedicated/customer-managed databases are future enterprise extensions.
- All 323 automated tests passing (230 RSpec, 62 Vitest, 31 Playwright E2E).

---

## 10. Architecture Decisions Summary

| Decision | Implemented Baseline | Status |
| --- | --- | --- |
| **Frontend** | React 19 SPA built with Vite 8 and TailwindCSS 4 | Operational / Verified |
| **Backend** | Ruby on Rails 7.2.1 API on ECS Fargate behind ALB | Operational / Verified |
| **Background Jobs** | Sidekiq 7.3.9 service with Redis 7 queue | Operational / Verified |
| **Database** | Amazon RDS for PostgreSQL 16; shared schema + tenant_id | Operational / Verified |
| **Tenant Protection** | Application Pundit policies + PostgreSQL RLS (`app.current_tenant_id`) | Operational / Verified |
| **File Storage** | Amazon S3 with tenant-scoped access and 24h export lifecycle | Operational / Verified |
| **Batch Bulk Workflows** | 500-record batch chunking, in-memory validation, bulk `insert_all` | Operational / Verified (10k import in 7.47s) |
| **Deterministic Seed** | `BenchmarkSeedService` populates 10,000 employees using `srand(42)` | Operational / Verified (6.12s) |
| **Operational Health** | `/health/live`, `/health/ready`, `/health/workers` | Operational / Verified |
| **Security** | TLS 1.3, KMS encryption, BCrypt password hashing, JWT session auth | Operational / Verified |
