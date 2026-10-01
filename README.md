# Global Employee Compensation Management System

A multi-tenant SaaS application for employee and compensation management across organizations, countries, and currencies.

**Incubyte Staff Rails Assessment**

---

## Architecture

```
Browser → CloudFront → WAF → ALB → Rails API (ECS Fargate)
                                         ↓              ↓
                                    PostgreSQL      Sidekiq (ECS)
                                    (RDS, RLS)         ↓
                                                     Redis
                                                       ↓
                                                  S3 (CSV files)
```

**Stack:** Ruby 3.3.0 · Rails 7.2.4 (API mode) · React 19 · Vite 8 · PostgreSQL 16 · Sidekiq 7.3 · Redis 7 · AWS S3

**Key Architecture Decisions (Decision Log):**

| ID | Decision | Status |
|----|----------|--------|
| D-01 | Multi-tenant SaaS — shared application, strict tenant isolation | Operational |
| D-02 | Shared PostgreSQL schema + `tenant_id` logical separation | Operational |
| D-03 | PostgreSQL RLS defense-in-depth (`SET LOCAL ROLE app_user` + `app.current_tenant_id`) | Validated & Enforced |
| D-04 | Tenant identity from session only — never from browser params | Enforced |
| D-05 | Domain-scoped HR Manager access; Org Admin global domain access | Operational |
| D-06 | Multi-country/currency records; zero cross-currency aggregation | Operational |
| D-08 | Rails modular monolith + React SPA | Operational |
| D-11 | Sidekiq + Redis for async CSV jobs | Operational |
| D-12 | CSV import and export are P0 and asynchronous | Operational |
| D-14 | Liveness (`/health/live`), readiness (`/health/ready`), and worker health (`/health/workers`) | Operational |
| D-18 | Bounded batch bulk processing (`BATCH_SIZE = 500`) with PostgreSQL `insert_all` | Operational (10k import in 7.47s) |
| D-19 | Deterministic 10,000 synthetic employee seed via `BenchmarkSeedService` (`srand(42)`) | Operational |

See [`docs/07_DECISION_LOG.md`](docs/07_DECISION_LOG.md) for full decision log.

---

## Data Model

```
Tenant → User (organization_admin | hr_manager)
       → Domain → UserDomainAssignment
       → Employee (tenant_id, domain_id)
                → CompensationRecord (effective-dated, NUMERIC money)
                  → CompensationComponent (base_salary, bonus, commission, allowance)
       → ImportJob (Sidekiq async, batch processing, rollback metadata)
       → ExportJob (Sidekiq async, cursor streaming, 24h download expiry)
```

PostgreSQL Row-Level Security (RLS) is enabled on all tenant-owned tables (`employees`, `compensation_records`, `compensation_components`, `domains`, `user_domain_assignments`, `users`, `import_jobs`, `export_jobs`). Tenant context is set transaction-locally via `set_config('app.current_tenant_id', id, true)`.

---

## Performance Benchmarks (10,000 Dataset)

| Operation | Performance Result | Implementation Strategy |
| :--- | :--- | :--- |
| **Deterministic Seed (`10,000` rows)** | **5.45 seconds** | `insert_all` bulk insertion, idempotent skip in 0.0s |
| **CSV Import (`10,000` rows)** | **7.47 seconds** | Bounded batching (500/chunk), in-memory validation, bulk `insert_all` |
| **CSV Export (`10,000` rows)** | **2.82 seconds** | Cursor batching (1,000/chunk), streaming CSV writer, lean progress polling |
| **Directory Index & Pagination** | **< 1.5 ms** | Tenant-scoped composite indexes, Kaminari pagination |
| **Analytics Aggregation** | **< 20 ms** | Currency-segregated SQL `GROUP BY`, no cross-currency summation |

---

## Local Development

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local frontend dev/testing)

### Start all services

```bash
cp .env.example .env
docker compose up -d
```

Starts 5 services:

| Service    | URL / Port        | Notes |
|------------|-------------------|-------|
| Frontend   | http://localhost:3000 | React 19 + Vite |
| Backend    | http://localhost:3001 | Rails 7.2 API |
| PostgreSQL | localhost:5432    | PostgreSQL 16 with RLS |
| Redis      | localhost:6379    | Redis 7 for Sidekiq queues |
| Sidekiq    | (worker, no port) | Background worker |

### Run migrations and seed

```bash
docker compose exec backend bin/rails db:migrate
docker compose exec backend bin/rails db:seed
```

*(Note: `db:seed` automatically seeds both Tenant 1: Acme Corporation with 4 demo employees and Tenant 2: Globex Corporation with 10,000 deterministic synthetic employees).*

To re-run or benchmark custom counts:
```bash
docker compose exec backend bundle exec rake db:seed:benchmark COUNT=10000 FORCE=true
```

---

## Test Suites (323 Automated Tests — 100% Passing)

### 1. Backend RSpec Suite (230 tests)
```bash
docker compose exec backend bundle exec rspec
```

### 2. Frontend Vitest Unit Suite (62 tests)
```bash
cd frontend
npm.cmd test -- --run
```

### 3. Frontend Playwright End-to-End Browser Automation (31 tests)
```bash
cd frontend
npx.cmd playwright test
```

---

## Demo Accounts

| Organization | Role | Email | Password | Scope / Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Acme Corporation** | **Org Admin** | `admin@example.com` | `password123` | Full admin authority across all domains (demo dataset) |
| **Acme Corporation** | **HR Manager** | `hr@example.com` | `password123` | Restricted strictly to `Engineering` domain |
| **Globex Corporation** | **Benchmark Admin** | `admin@globex.com` | `password123` | Global admin access over **10,000 synthetic employees** |
| **Globex Corporation** | **Benchmark HR** | `hr@globex.com` | `password123` | Scoped HR manager over Globex `Engineering` domain |

---

## API Endpoints

| Endpoint | Method | Description | Scope |
|----------|--------|-------------|-------|
| `/api/session` | `POST` | Authenticate user & start session | Public |
| `/api/session` | `GET` | Current authenticated user context | Authenticated |
| `/api/session` | `DELETE` | Terminate session | Authenticated |
| `/api/employees` | `GET` | List employees (paginated, filtered, searched) | Tenant + Domain |
| `/api/employees` | `POST` | Create employee | Tenant + Domain |
| `/api/employees/:id` | `GET` | Show employee details | Tenant + Domain |
| `/api/employees/:id` | `PATCH` | Update employee record | Tenant + Domain |
| `/api/employees/:id/compensation` | `GET` | Historical compensation packages | Tenant + Domain |
| `/api/employees/:id/compensation` | `POST` | Supersede & create new package revision | Tenant + Domain |
| `/api/employees/:id/compensation/:cid` | `PATCH` | Edit existing active package in-place | Tenant + Domain |
| `/api/imports` | `POST` | Queue asynchronous CSV import job | Tenant + Domain |
| `/api/imports/:id` | `GET` | Poll import job progress & error summary | Tenant |
| `/api/imports/:id/cancel` | `POST` | Cancel active import and rollback inserted rows | Tenant |
| `/api/imports/:id/rollback` | `POST` | Revert completed import job and restore previous state | Tenant |
| `/api/exports` | `POST` | Queue asynchronous CSV export job | Tenant + Domain |
| `/api/exports/:id` | `GET` | Poll export job progress & status | Tenant |
| `/api/exports/:id/download` | `GET` | Re-authorize & stream generated CSV | Tenant + Domain |
| `/api/reports/workforce` | `GET` | Headcount by country & department breakdown | Tenant + Domain |
| `/api/reports/compensation` | `GET` | Currency-segregated budgets and averages | Tenant + Domain |
| `/health/live` | `GET` | Process liveness check (no DB dependency) | Public |
| `/health/ready` | `GET` | Readiness check (validates DB + Redis) | Public |
| `/health/workers` | `GET` | Sidekiq worker heartbeat and queue latencies | Public |

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [`docs/00_AI_PROMPTS_AND_DESIGN_PACK.md`](docs/00_AI_PROMPTS_AND_DESIGN_PACK.md) | Official Incubyte AI Prompts & Documentation Design Pack |
| [`docs/01_PRD.md`](docs/01_PRD.md) | Product Requirements Document |
| [`docs/02_HLD.md`](docs/02_HLD.md) | High-Level Architecture Design |
| [`docs/03_LLD.md`](docs/03_LLD.md) | Low-Level Technical Design |
| [`docs/Incubyte_Employee_Compensation_TAR.md`](docs/Incubyte_Employee_Compensation_TAR.md) | Technical Architecture Review |
| [`docs/04_TEST_PLAN.md`](docs/04_TEST_PLAN.md) | Test Plan & Verification Matrix |
| [`docs/05_DELIVERY_PLAN.md`](docs/05_DELIVERY_PLAN.md) | Milestone Delivery Plan |
| [`docs/06_AI_USAGE_LOG.md`](docs/06_AI_USAGE_LOG.md) | Transparent AI Usage Log |
| [`docs/AI_PROMPTS_AND_INSTRUCTIONS.md`](docs/AI_PROMPTS_AND_INSTRUCTIONS.md) | AI Prompts, Instructions & Engineering Methodology |
| [`docs/07_DECISION_LOG.md`](docs/07_DECISION_LOG.md) | Architecture Decision Register (ADR) |
| [`docs/08_DEMO_SCRIPT.md`](docs/08_DEMO_SCRIPT.md) | Assessment Demo Walkthrough Script & Guide |
| [`docs/09_ASSESSMENT_README.md`](docs/09_ASSESSMENT_README.md) | Formal Assessment Submission Documentation |
| [`docs/architecture_diagram.png`](docs/architecture_diagram.png) | High-Level Architecture Topology Diagram |
