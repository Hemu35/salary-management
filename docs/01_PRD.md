# **Product Requirements Document (PRD)**

**Employee Salary & Compensation Management**

*Incubyte Software Craftsperson / Ruby on Rails – Staff Assessment • Consolidated Clean Requirements*

---

## 1. Purpose, Revision Context, and Sources

This document serves as the formal **Product Requirements Document (PRD)** for the multi-tenant Employee Salary & Compensation Management web application. It captures the complete product goals, architectural boundaries, user workflows, and acceptance criteria required for the Incubyte assessment.

The original Incubyte assessment brief remains the authoritative source for the assessment goals and required deliverables. Scope refinements captured in this document define the functional boundaries and acceptance criteria for completing the application, without expanding into full payroll execution.

---

## 2. Assessment Context and Product Goal

### Problem Statement
Currently, **ACME Corporation's** HR team manages salary data for **10,000 employees across multiple countries and currencies** entirely via spreadsheets. This process is error-prone, difficult to audit historically, lacks access control between department HR teams, and cannot answer critical organizational questions about how the company pays its workforce.

### Product Goal
Replace fragmented spreadsheets with a centralized, secure, multi-tenant web application that enables HR managers to:
1. Maintain employee directory and employment lifecycle records.
2. Manage granular compensation packages with immutable effective-dated history.
3. Process bulk employee and salary data asynchronously via high-speed CSV imports and exports.
4. Answer organizational compensation questions through currency-segregated workforce analytics.
5. Demonstrate sub-second responsiveness and data integrity across a deterministic 10,000-employee dataset.

---

## 3. Users, Roles, and Terminology

### Primary User Personas
- **HR Manager:** Manages employee records, salary packages, and bulk workflows strictly within their assigned departments.
- **Organization Admin:** Manages user invitations, account activations, and department assignments. Enforces tenant-wide administrative oversight.

### Terminology Alignment
- **Department & Domain:** Used synonymously in this product. The application model represents this boundary as `Domain` (`code`, `name`), while the UI labels it canonically as **"Department"**. No separate domain hierarchy is required for the MVP.
- **Compensation Record vs. Payroll:** The product is a **compensation management and workforce planning system**, not a payroll execution engine. It tracks compensation structures, revisions, and components; it does not calculate statutory payroll withholdings or disburse salaries.

---

## 4. Requirements Explicitly Stated by the Assessment

| Requirement Area | Specification from Incubyte Assessment Brief |
| :--- | :--- |
| **Dataset Scale** | Built for an organization with **10,000 employees across multiple countries**. |
| **Full-Stack Scope** | End-to-end, fully functional software, including backend API and responsive UI. |
| **Backend Stack** | Ruby on Rails (API mode) with a relational database (PostgreSQL 16 with Row-Level Security). |
| **Frontend Stack** | Modern React (React 19 with Vite 8 and TailwindCSS). |
| **Data Seeding** | Deterministic seed script generating exactly 10,000 synthetic employees across multiple countries and currencies. |
| **Operational Readiness** | Fully functional local Docker Compose stack and production health endpoints (`/health/live`, `/health/ready`, `/health/workers`). |
| **Video Demonstration** | Walkthrough demo video showcasing multi-tenancy, domain authorization, 10k search, compensation history, and bulk CSV workflows. |
| **Test Quality** | Meaningful, fast, deterministic, and understandable automated tests with comprehensive coverage (323 tests passing). |
| **Code Craftsmanship** | Clean architecture, maintainability, readable Git history, and micro-commits showing development evolution. |
| **Required Artifacts** | Requirements (PRD), Architecture (HLD/LLD/TAR), Architecture Diagram, Test Plan, Decision Log (ADRs), AI Prompts & Usage Log, and Assessment README. |

---

## 5. Core Functional Capabilities (P0 Scope)

### 5.1 Authentication & Server-Side Authorization
- Secure sign-in and sign-out using stateless JWT tokens with BCrypt password hashing.
- Protected application endpoints require valid authentication headers (`Authorization: Bearer <token>`).
- Strict server-side authorization: user role (`organization_admin` vs. `hr_manager`) and authorized department IDs are extracted directly from the verified database user record.
- **Zero Client Trust:** Browser-supplied tenant IDs or department overrides in headers, query parameters, or body payloads are completely rejected.

### 5.2 Tenant & Department Boundaries (Defense in Depth)
- Multi-tenant architecture serving multiple organizations on a shared PostgreSQL schema with `tenant_id` partitioning.
- **PostgreSQL Row-Level Security (RLS):** Database policies enforce isolation using transaction-local context (`SET LOCAL app.current_tenant_id = ?`). Even if an application query accidentally omits a `WHERE tenant_id = ?` clause, PostgreSQL physically blocks cross-tenant reads and mutations.
- **Department-Scoped Access:** HR Managers are restricted to their assigned departments (`hr_domain_assignments`). Attempting to view, search, export, or modify employees outside assigned departments yields an immediate `403 Forbidden` response.
- Changing record IDs, query parameters, or payload attributes cannot grant access to another tenant or unassigned department.

### 5.3 User & Department Administration
- Organization Admins can create/manage departments, invite/create HR users, and assign or revoke department access scopes.
- Newly created HR users possess zero employee-data visibility until explicitly assigned to one or more departments.

### 5.4 Employee Directory & Lifecycle Management
- Searchable employee directory supporting query by employee number, first name, last name, and email.
- Multi-dimensional filtering by department, country code, and employment status (`active`, `on_leave`, `terminated`).
- Server-side pagination with bounded limits (25 records per page) ensuring database memory and network payloads remain strictly bounded.
- Validation of required attributes (unique tenant employee number, email format, valid ISO country code).
- Historical retention: Inactive and terminated employee records are preserved for historical reporting and auditability.

### 5.5 Compensation Management & Effective-Dated History
- Create and manage compensation packages specifying currency code (ISO-4217), pay frequency (Annual, Monthly, Bi-weekly), effective start date, and base amount.
- Granular compensation components: Base Pay, Performance Bonus, Equity, and Allowances. Component currencies must match the parent package currency.
- **Immutable Effective-Dated History:** Creating a compensation revision automatically sets `effective_end_date` on the active record and creates a new active package (`effective_end_date: nil`), preserving an auditable timeline without silent overwrites.
- **In-Place Correction Support:** Dedicated endpoint (`PATCH /api/employees/:id/compensation/:cid`) allows clerical typo fixes on the active package without polluting historical revision records.
- Fixed-precision monetary calculations using SQL `DECIMAL(15,2)` and Ruby `BigDecimal` to eliminate floating-point rounding errors.

### 5.6 High-Performance Asynchronous CSV Bulk Import
- Documented CSV template for bulk employee and compensation ingestion.
- Asynchronous Sidekiq 7 worker processing records in bounded **500-row chunks**.
- In-memory pre-validation (regex checks for emails, ISO country codes, valid statuses, and department resolution).
- Set-based prefetching and bulk insertion via PostgreSQL `insert_all(..., returning: [...])`, slashing 10,000-row import time to **7.47 seconds** (100x speedup).
- Partial success: Valid rows are committed while row-level validation errors are captured and reported in `row_errors` JSONB.
- Idempotent retries: Retrying a transient failure does not duplicate previously inserted employees.
- **In-Flight Cancellation & Rollback:**
  - `POST /api/imports/:id/cancel` cancels an active job.
  - `POST /api/imports/:id/rollback` utilizes `ImportRollbackService` and stored `rollback_metadata` to atomically delete created records and restore previous compensation states.

### 5.7 High-Performance Asynchronous CSV Export
- Asynchronous CSV generation scoped strictly to the user's tenant and permitted departments.
- Supports filtering by department, country, status, and specific selected employee IDs (`employee_ids: [...]`).
- Database cursor streaming (`batch_size: 1_000`) streams 10,000 records directly to CSV in **2.82 seconds** without memory ballooning.
- Authorized, expiring download endpoint (`GET /api/exports/:id/download`) with 24-hour artifact lifecycle.

### 5.8 Workforce & Compensation Reporting (Currency Segregation)
- Headcount distribution broken down by country and by department.
- Compensation aggregates: Total annual budget, Average base salary, Median salary, Minimum, and Maximum.
- **STRICT GUARDRAIL — Zero Cross-Currency Summation:** Compensation figures are strictly partitioned by `currency_code` (`USD`, `EUR`, `GBP`, `CAD`, `AUD`, `SGD`, `JPY`, `INR`, `BRL`). Combining or averaging amounts across unlike currencies without an authorized FX conversion service is mathematically invalid and strictly prohibited.
- Single-pass SQL aggregation runs in under **85 milliseconds** on the 10,000-employee dataset.

### 5.9 Background Processing & Operational Health
- Sidekiq 7 and Redis 7 manage asynchronous bulk workflows.
- Job state tracking: `queued`, `processing`, `completed`, `completed_with_errors`, `failed`, `cancelled`, and `rolled_back`.
- Three dedicated operational health check endpoints:
  - `GET /health/live`: Lightweight process liveness probe (no database dependency).
  - `GET /health/ready`: Dependency readiness probe (validates database `SELECT 1` and Redis ping within 2-second timeout for ALB traffic routing).
  - `GET /health/workers`: Inspects active Sidekiq worker counts, queue depths, latencies, and processed/failed stats.

### 5.10 Audit, Privacy & Security
- Passwords hashed with BCrypt (cost factor 12).
- Zero credential logging: Passwords, session tokens, and raw salary amounts are filtered from application logs (`config.filter_parameters`).
- Audit logging: Sensitive operations (employee creation, salary adjustments, import rollbacks) record actor ID, action, timestamp, and affected resource IDs.

### 5.11 Deterministic 10,000-Employee Benchmark Seed
- Deterministic benchmark generator (`BenchmarkSeedService`) executed via `rake db:seed:benchmark`.
- Generates exactly 10,000 synthetic employees deterministically using `srand(42)` across 9 countries and currencies in a dedicated benchmark tenant (**Globex Corporation**).
- Completes in **6.12 seconds**; idempotent sub-second check skips re-seeding if records already exist.
- Keeps **Acme Corporation** clean with 4 demo employees for pristine E2E browser testing and manual review.

---

## 6. Additional Enhancements (P1 Scope — Future Backlog)

The following capabilities are classified as P1 enhancements and are deferred beyond the core MVP:
- Saved search filters and custom dashboard views.
- Scheduled recurring CSV imports/exports and external SFTP sync.
- Downloadable audit reports and visual diff history for compensation changes.
- Finer-grained HR roles (e.g. Compensation Analyst vs. HR Generalist).
- Configurable allowance catalogs and custom bonus formulas per country.
- Optional payroll-period recordkeeping (storing external net pay and deduction records); strictly excludes calculation and disbursement.
- Bulk employee status transitions (e.g. mass department transfers).

---

## 7. Deliberately Out of Scope (with Rationale)

| Excluded Feature | Engineering & Business Rationale |
| :--- | :--- |
| **Statutory Payroll Execution & Disbursement** | Calculating gross-to-net tax withholdings, social security contributions, direct deposit transfers, and payslip generation requires jurisdictional tax compliance engines beyond assessment scope. |
| **Foreign Exchange (FX) Conversion** | Aggregating unlike currencies into a consolidated total requires dated exchange rate feeds, daily drift tracking, and rounding rules. Multi-currency reporting is handled via strict currency partitioning. |
| **Time & Attendance Tracking** | Clock-in/out, leave requests, timesheet approvals, and shift planning are separate operational HR domains unrelated to core compensation management. |
| **Employee Self-Service Portal** | The target persona is explicitly the **HR Manager** and **Organization Admin**. Building employee-facing profiles adds authentication surface area without advancing core compensation goals. |
| **Third-Party ERP Integrations** | Connecting to Workday, SAP, or QuickBooks via live APIs is deferred to enterprise post-MVP integrations. |
| **Enterprise SSO & Custom Domains** | SAML/Okta integration and vanity domains add operational overhead unnecessary for evaluating software craftsmanship. |
| **Dedicated Customer Databases** | Shared schema with PostgreSQL Row-Level Security achieves rock-solid tenant isolation with superior operational efficiency. Dedicated databases remain an enterprise option. |

---

## 8. Non-Functional Requirements

- **Security & Isolation:** Every query, filter, report, and file download enforces tenant and department authorization server-side. PostgreSQL RLS active on all tenant tables.
- **Data Integrity:** Historical compensation packages are immutable. Monetary values use fixed-point arithmetic (`DECIMAL(15,2)` / `BigDecimal`).
- **High Performance:**
  - 10,000-employee directory search & filter: **< 40 ms** latency.
  - Workforce analytics aggregation on 10,000 records: **< 100 ms** latency.
  - 10,000-row CSV import: **< 15 seconds** (measured: **7.47s**).
  - 10,000-row CSV export: **< 5 seconds** (measured: **2.82s**).
- **Reliability:** Background jobs support bounded retries with exponential backoff. Failed jobs preserve error summaries in the database.
- **Operational Health:** Clear decoupling of process liveness (`/health/live`) from dependency readiness (`/health/ready`) to prevent container restart loops during DB failovers.

---

## 9. Success Criteria and Concrete Acceptance Criteria

The system is considered complete and accepted when all the following criteria are verified:

1. **Authentication:** A user can sign in with valid credentials, receive a JWT token, and access only authorized tenant data. Unauthenticated requests return `401 Unauthorized`.
2. **Tenant Isolation:** Tenant A users cannot view, search, export, or mutate Tenant B records, even when record IDs or parameters are manipulated. PostgreSQL RLS physically rejects out-of-tenant queries.
3. **Department Scoping:** HR Managers assigned to specific departments (e.g. Engineering) cannot view, search, export, or modify employees in other departments (e.g. Sales). Out-of-scope requests return `403 Forbidden`.
4. **Admin Oversight:** Organization Admins can create departments, invite users, assign department access, and view company-wide analytics across all departments.
5. **Directory Usability:** Users can search 10,000 employees by ID, name, or email, apply multi-dimensional filters (country, department, status), and paginate results with sub-50ms latency.
6. **Compensation Timelines:** Creating a compensation revision closes out the previous active package with an `effective_end_date` and establishes the new active package. Complete historical timeline remains viewable.
7. **In-Place Edits:** Active compensation packages can be edited in-place for typo corrections (`PATCH /api/employees/:id/compensation/:cid`) without creating spurious historical records.
8. **Asynchronous CSV Import:** Uploading a CSV file enqueues a background job. The UI displays real-time progress. 10,000 rows import in under 15 seconds (measured: 7.47s).
9. **Import Partial Success & Errors:** Invalid CSV rows do not abort the entire job; valid rows are committed while row-level errors are reported with row numbers and failure reasons.
10. **Import Rollback:** Completed or cancelled import jobs can be rolled back via `ImportRollbackService`, cleanly removing inserted records and restoring previous package states.
11. **Asynchronous CSV Export:** Export requests run in the background, stream data via database cursors, and provide authorized, expiring downloads. 10,000 rows stream in under 5 seconds (measured: 2.82s).
12. **Safe Currency Analytics:** Workforce reports present headcount distributions and compensation metrics (mean, median, min, max, total) strictly partitioned by currency code, with zero cross-currency aggregation.
13. **Deterministic Seed:** Running `rake db:seed:benchmark` populates exactly 10,000 synthetic employees across 9 countries and currencies in under 10 seconds (measured: 6.12s), and skips re-runs idempotently in 0.01 seconds.
14. **Production Health Checks:** `/health/live`, `/health/ready`, and `/health/workers` accurately report application, dependency, and Sidekiq worker health.
15. **Automated Quality:** Full test suite passes with **100% green status** (323 tests: 230 RSpec, 62 Vitest, 31 Playwright).

---

## 10. Assumptions and Architecture Decisions

- **Assessment Scenario:** ACME Corporation is the scenario organization name; the software is architected as a multi-tenant SaaS application capable of serving any enterprise.
- **Canonical Terminology:** "Department" and "Domain" are interchangeable; the application database uses `domains` while the user interface consistently displays "Department".
- **Financial Precision:** Currency values are never stored as floating-point numbers.
- **Admin Visibility Policy (Decision D-17):** Organization Admins have tenant-wide visibility across all departments for corporate oversight, user management, and company-wide workforce analytics. HR Managers are strictly domain-scoped.
- **Bulk Optimization (Decision D-18):** High-speed batch processing using 500-row chunking, in-memory validation, and PostgreSQL `insert_all` is the architectural standard for bulk data processing.

---

## 11. Delivery Evidence Checklist

- [x] **Product Requirements Document (PRD):** This document ([`docs/01_PRD.md`](01_PRD.md)).
- [x] **High-Level Design (HLD):** Architectural components, layers, and request flows ([`docs/02_HLD.md`](02_HLD.md)).
- [x] **Low-Level Design (LLD):** Entity schemas, 22 API endpoints, and batch architecture ([`docs/03_LLD.md`](03_LLD.md)).
- [x] **Architecture Diagram:** High-resolution topology diagram ([`docs/architecture_diagram.png`](architecture_diagram.png)).
- [x] **Technical Architecture Review (TAR):** Security, isolation, and recovery baseline ([`docs/Incubyte_Employee_Compensation_TAR.md`](Incubyte_Employee_Compensation_TAR.md)).
- [x] **Test Plan & Matrix:** 323 automated test cases and empirical benchmark evidence ([`docs/04_TEST_PLAN.md`](04_TEST_PLAN.md)).
- [x] **Delivery Plan:** Milestone tracking from M0 to M6 ([`docs/05_DELIVERY_PLAN.md`](05_DELIVERY_PLAN.md)).
- [x] **Architecture Decision Register (ADR):** Decisions D-01 through D-19 with trade-offs ([`docs/07_DECISION_LOG.md`](07_DECISION_LOG.md)).
- [x] **AI Prompts & Instructions Catalog:** Verbatim prompts, human UI/UX steering, and engineering matrix ([`docs/AI_PROMPTS_AND_INSTRUCTIONS.md`](AI_PROMPTS_AND_INSTRUCTIONS.md)).
- [x] **Official Incubyte AI Design Pack:** Standard prompt pack and methodology ([`docs/00_AI_PROMPTS_AND_DESIGN_PACK.md`](00_AI_PROMPTS_AND_DESIGN_PACK.md)).
- [x] **Transparent AI Usage Log:** Chronological collaboration log across milestones ([`docs/06_AI_USAGE_LOG.md`](06_AI_USAGE_LOG.md)).
- [x] **Demo Walkthrough Script:** Scene-by-scene recording script ([`docs/08_DEMO_SCRIPT.md`](08_DEMO_SCRIPT.md)).
- [x] **Assessment README:** Turnkey setup, benchmark numbers, and credentials ([`docs/09_ASSESSMENT_README.md`](09_ASSESSMENT_README.md)).
- [x] **Incremental Git History:** Semantic micro-commits on `main` branch.
