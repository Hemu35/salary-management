# Global Employee Compensation Management System

A multi-tenant SaaS application for employee and compensation management across organizations, countries, and currencies.

**Incubyte Staff Rails Assessment — v2.5**

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

**Stack:** Ruby 3.3 · Rails 7.2 API · React 19 · PostgreSQL 16 · Sidekiq 7 · Redis 7 · AWS S3

**Key architecture decisions (Decision Log v2.5):**

| ID | Decision |
|----|----------|
| D-01 | Multi-tenant SaaS — shared application, strict tenant isolation |
| D-02 | Shared PostgreSQL schema + `tenant_id` logical separation |
| D-03 | PostgreSQL RLS as defense-in-depth alongside app authorization |
| D-04 | Tenant identity from session only — never from browser params |
| D-05 | Domain-scoped HR Manager access within tenant |
| D-06 | Multi-country/currency records; no FX conversion |
| D-08 | Rails modular monolith + React SPA |
| D-11 | Sidekiq + Redis for async CSV jobs (P0) |
| D-12 | CSV import and export are P0 and asynchronous |
| D-14 | Separate liveness (`/health/live`) and readiness (`/health/ready`) checks |

See [`docs/07_DECISION_LOG_v2.5.docx`](docs/07_DECISION_LOG_v2.5.docx) for full decision log.

---

## Data Model

```
Tenant → User (org_admin | hr_manager)
       → Domain → UserDomainAssignment
       → Employee (tenant_id, domain_id)
                → CompensationRecord (effective-dated, NUMERIC money)
                  → CompensationComponent
       → ImportJob / ExportJob (Sidekiq async)
       → AuditEvent
```

PostgreSQL RLS is enabled on all tenant-owned tables. Tenant context is set transaction-locally via `set_config('app.current_tenant_id', id, true)`.

---

## Local Development

### Prerequisites
- Docker Desktop

### Start all services

```bash
cp .env.example .env
docker compose up -d
```

This starts 5 services:

| Service    | URL / Port        |
|------------|-------------------|
| Frontend   | http://localhost:3000 |
| Backend    | http://localhost:3001 |
| PostgreSQL | localhost:5432    |
| Redis      | localhost:6379    |
| Sidekiq    | (worker, no port) |

### Run migrations and seed

```bash
docker compose exec backend bin/rails db:migrate
docker compose exec backend bin/rails db:seed
```

### Run tests

```bash
docker compose exec backend bundle exec rspec
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/session` | Login |
| `DELETE /api/session` | Logout |
| `GET /api/employees` | List employees (paginated, filtered) |
| `POST /api/employees` | Create employee |
| `GET/PATCH /api/employees/:id` | Show/update employee |
| `GET/POST /api/employees/:id/compensation` | Compensation history |
| `POST /api/imports` | Queue CSV import |
| `GET /api/imports/:id` | Import job status |
| `POST /api/exports` | Queue CSV export |
| `GET /api/exports/:id/download` | Download export |
| `GET /api/reports/workforce` | Headcount by country/domain |
| `GET /api/reports/compensation` | Compensation grouped by currency |
| `GET /health/live` | Liveness check |
| `GET /health/ready` | Readiness check |

---

## Demo Account

```
Email:    hr@example.com
Password: password123
```

---

## Documents

| Document | Description |
|----------|-------------|
| [`docs/01_PRD_v2.5.docx`](docs/01_PRD_v2.5.docx) | Product Requirements |
| [`docs/02_HLD_v2.5.docx`](docs/02_HLD_v2.5.docx) | High-Level Design |
| [`docs/03_LLD_v2.5.docx`](docs/03_LLD_v2.5.docx) | Low-Level Design |
| [`docs/Incubyte_Employee_Compensation_TAR.docx`](docs/Incubyte_Employee_Compensation_TAR.docx) | Technical Architecture Review |
| [`docs/04_TEST_PLAN_v2.5.docx`](docs/04_TEST_PLAN_v2.5.docx) | Test Plan |
| [`docs/05_DELIVERY_PLAN_v2.5.docx`](docs/05_DELIVERY_PLAN_v2.5.docx) | Delivery Plan |
| [`docs/07_DECISION_LOG_v2.5.docx`](docs/07_DECISION_LOG_v2.5.docx) | Decision Log |
| [`docs/architecture_diagram.png`](docs/architecture_diagram.png) | Architecture Diagram |
