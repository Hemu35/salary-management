# **AI Prompts, Instructions & Engineering Methodology**

**Global Employee Compensation Management System**

*Incubyte Staff Rails Assessment • AI Collaboration Artifact*

---

## 1. Executive Summary & AI Development Methodology

This assessment was developed using an **AI-accelerated, engineer-steered methodology**. In accordance with the Incubyte evaluation criteria, AI tools were used intentionally to accelerate boilerplate implementation, test generation, and architectural analysis, while **strict human engineering judgment** governed system architecture, security invariants, data integrity, and performance trade-offs.

### Core Engineering Invariants Enforced Across All Prompts:
1. **Zero Client Trust:** Tenant ID and domain assignments must never be trusted from client parameters or headers; they are derived exclusively from verified JWT server-side claims.
2. **Defense in Depth:** Application-level authorization (Pundit) must be reinforced by database-level isolation (PostgreSQL Row-Level Security).
3. **Strict Domain & Currency Boundaries:** No cross-currency summation under any circumstance; HR Managers are strictly domain-scoped.
4. **Deterministic & Observable:** 100% reproducible benchmark data (`srand(42)`) and comprehensive automated test suites (323 tests).
5. **High-Performance Batching:** Bulk workflows (10k rows) must use bounded batch chunking and set-based SQL operations, avoiding per-row database round-trips.

---

## 2. Chronological Prompt & Instruction Catalog

Below is the complete record of prompts, system instructions, human steering, and engineering decisions applied throughout development.

---

### Phase 0: Requirements Framing, PRD & Architecture Decisions (Milestone 0)

#### Prompt Given to AI:
```markdown
Context:
We are building a multi-tenant Global Employee Compensation Management System for an organization with 10,000 employees across multiple countries and currencies, replacing spreadsheet-based tracking.
Role: Incubyte Staff Software Craftsperson (Ruby on Rails + React).

Task:
1. Analyze the problem statement and draft a one-page Product Requirements Document (PRD) covering:
   - Goal & Executive Summary
   - User Personas (Organization Admin vs HR Manager)
   - P0 core scope vs P1 vs Deliberately Out of Scope features (with explicit reasoning)
   - Non-functional requirements (10k synthetic employees, deterministic testing, data protection)
2. Generate an Architecture Decision Register (ADR log D-01 through D-17) capturing trade-offs:
   - Why Rails modular monolith + React SPA?
   - Why shared RDS PostgreSQL schema with tenant_id + RLS defense in depth instead of DB-per-tenant?
   - Why Sidekiq + Redis for async CSV jobs without SQS/DLQ in MVP?
   - Explicitly forbid FX conversion and statutory payroll calculations in MVP.
```

#### Human Steering & AI Output Review:
- **AI Proposal:** Suggested including a dynamic FX currency conversion service and microservices decomposition.
- **Human Engineering Correction:** **Rejected.** Adhered strictly to the Incubyte prompt requirement: *"We are not looking for the most complex system, but for good engineering judgment."* FX rates introduce currency date drift and statutory payroll introduces jurisdiction complexity beyond assessment scope. We locked the scope to a clean, robust modular monolith with currency-segregated reporting.

---

### Phase 1: Multi-Tenancy, Authentication & PostgreSQL RLS (Milestone 1)

#### Prompt Given to AI:
```markdown
Context:
Rails 7.2 API mode with PostgreSQL 16. We need bulletproof tenant isolation.

Task:
1. Implement Tenant, User, Domain, and UserDomainAssignment models with BCrypt authentication and JWT session tokens.
2. Create a database migration enabling PostgreSQL Row-Level Security (RLS) on all tenant-owned tables.
3. Design a TenantScoped controller concern that establishes tenant context safely.
Important:
- How do we set `app.current_tenant_id` in PostgreSQL without leaking state across pooled connections?
- How do we ensure RLS is enforced even for the application DB user?
- Provide RSpec integration tests verifying that Tenant A cannot access Tenant B records under any circumstances.
```

#### Human Steering & AI Output Review:
- **AI Proposal:** Initially proposed setting `ActiveRecord::Base.connection.execute("SET app.current_tenant_id = #{id}")` as a persistent session variable.
- **Human Engineering Correction:** **Rejected.** In connection-pooled environments (Puma / Hikari), a global `SET` persists on the connection and will contaminate the next request that borrows that thread! We mandated:
  ```ruby
  ActiveRecord::Base.transaction do
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(["SET LOCAL app.current_tenant_id = ?", tenant.id])
    )
    yield
  end
  ```
  `SET LOCAL` guarantees that the tenant context automatically unsets at transaction commit/rollback, eliminating connection pool leakage.

---

### Phase 2A: Domain-Scoped Authorization & Effective-Dated Backend Models (Milestone 2)

#### Prompt Given to AI:
```markdown
Context:
HR Managers in an enterprise manage specific employee domains (e.g. Engineering, Sales).
We need employee CRUD and an effective-dated compensation model.

Task:
1. Implement Pundit policies (`EmployeePolicy`, `CompensationRecordPolicy`) enforcing:
   - Organization Admin has tenant-wide access to all domains.
   - HR Manager has access ONLY to employees in their assigned domains (`user.domains`).
   - Access to unassigned domains must raise Pundit::NotAuthorizedError (HTTP 403).
2. Implement CompensationRecord and CompensationComponent:
   - A compensation package has an effective_start_date and optional effective_end_date.
   - When a new revision is created, the previous active record's effective_end_date must be closed out.
   - Prevent date overlaps and enforce ISO-4217 currency matching across components.
   - Use fixed-precision money representation.
```

#### Human Steering & AI Output Review:
- **AI Proposal:** Generated floating-point `FLOAT` columns for compensation amounts and simple `UPDATE` queries that overwrote historical salary records.
- **Human Engineering Correction:** **Rejected.**
  1. Monetary values must use `DECIMAL(15,2)` in PostgreSQL and `BigDecimal` in Ruby to prevent floating-point rounding errors.
  2. Overwriting salary records destroys historical audit trails. We mandated an immutable revision pattern: creating a new compensation package sets `effective_end_date` on the active record and creates a new active record (`effective_end_date: nil`), preserving the full chronological salary history.
  3. Added an in-place `PATCH /api/employees/:id/compensation/:cid` endpoint specifically for non-revision typo corrections.

---

### Phase 2B: Human-in-the-Loop UI/UX, Design Refinements & Compensation Functionalities

Throughout the implementation of the compensation management UI, multiple human interactions, visual critique, and user-centric redesigns took place to transform naive AI code into an intuitive, enterprise-grade HR experience:

#### Interaction 1: Fluid Layout & Modern Design System Overhaul
- **Initial AI Output:** Generated a narrow, centered layout with raw unstyled HTML tables and modals that overflowed the screen on smaller viewports.
- **Human Feedback & Prompt:**
  ```markdown
  The layout looks cramped, boxed, and visually amateur.
  1. Refactor the entire dashboard into a full-width fluid layout (`w-full px-6 py-8`) using modern Tailwind CSS.
  2. Style modals with clean backdrop blur (`backdrop-blur-sm bg-black/40`), centered alignment, and responsive vertical max-height with smooth scrolling (`max-h-[90vh] overflow-y-auto`).
  3. Improve typography, dark/light contrast, and whitespace to give it a polished enterprise SaaS feel.
  ```
- **Result:** Created responsive layout, clean modals, and polished design language implemented in commit `8a49681`.

#### Interaction 2: In-Place Edit vs. Effective-Dated Revision Workflow
- **Initial AI Output:** Offered only a single "Edit" button that created a new historical revision whenever any field was touched.
- **Human Critique & Prompt:**
  ```markdown
  HR Managers often make clerical typos (e.g. entering $120,000 instead of $125,000, or a misspelled component name).
  Creating a brand-new effective-dated revision for a typo pollutes the employee's audit history and distorts payroll reporting.
  We need TWO distinct workflows:
  1. "Add Compensation Revision" (creates a new package, closes previous package with end date).
  2. "Edit Active Package In-Place" (updates base salary or components of the CURRENT active package without creating a new historical record).
  ```
- **Result:** Implemented `PATCH /api/employees/:id/compensation/:cid` and separated the UI into distinct "Add Revision" and "Edit In-Place" actions in commits `12bf8d4` and `e4ff86c`.

#### Interaction 3: Component Pre-Population & Dynamic Row Management
- **Initial AI Output:** Opening the edit modal presented blank component rows, forcing the HR manager to re-type every existing bonus, equity, and allowance from scratch.
- **Human Feedback & Prompt:**
  ```markdown
  When opening the compensation edit modal, all existing active components (Bonus, Equity, Allowance, Commission) MUST be automatically pre-populated into the form.
  Users must be able to:
  - Dynamically add new component rows with a type selector dropdown.
  - Remove existing components with a single click.
  - See real-time calculation of total annual compensation (Base Salary + Components) as they type.
  - Automatically match component currency with the employee's base currency.
  ```
- **Result:** Implemented component pre-population, dynamic row management, and live total calculation in commit `e4ff86c`.

#### Interaction 4: Visual Audit Timeline for Historical Revisions
- **Initial AI Output:** Rendered compensation history as a flat, unstyled text list where past and present packages looked identical.
- **Human Critique & Prompt:**
  ```markdown
  Redesign the compensation history tab into an interactive visual timeline:
  - Prominently feature the current active package at the top with a green "Active" badge and "Effective: [Date] to Present".
  - Render previous revisions in chronological reverse order with gray "Historical" badges and explicit "Effective: [Start] to [End]" ranges.
  - Provide expandable component breakdowns (Base, Bonus, Equity) for each historical period so HR can audit salary trajectory over time.
  ```
- **Result:** Built the compensation history timeline in `CompensationModal.jsx` and verified via Vitest and Playwright tests.

#### Interaction 5: Confirmation Modals for Destructive Actions
- **Initial AI Output:** Used native browser `window.confirm()` popups for critical operations.
- **Human Feedback & Prompt:**
  ```markdown
  Browser `window.confirm()` is jarring and doesn't match the design system.
  Create a reusable in-app ConfirmationModal with customizable titles, warning text, destructive color accents (red buttons for rollback/delete), and keyboard escape handlers.
  ```
- **Result:** Built `ConfirmationModal.jsx` used for import rollback, cancellation, and package modifications in commit `d8d27b1`.

---

### Phase 3: High-Speed Asynchronous CSV Bulk Engine & 100x Optimization (Milestone 3 & 4)

#### Prompt Given to AI:
```markdown
Context:
We tested uploading a 1,000-row employee CSV file, and it took 85.04 seconds (~14 minutes for 10,000 rows).
This is unacceptably slow for an enterprise system managing 10,000 employees.

Diagnosis:
The existing `ImportJobWorker` processes rows one-by-one with individual ActiveRecord validations, per-row DB transactions, and N+1 domain/employee lookups.

Task:
Re-architect `ImportJobWorker` to achieve high performance (sub-15 seconds for 10,000 rows) while preserving:
1. Row-level error reporting (invalid rows shouldn't crash the whole job).
2. Domain resolution and tenant scoping.
3. Atomic rollback capability if the import is cancelled or undone.
Use:
- Bounded batch chunking (e.g., 500 rows).
- In-memory regex pre-validation for emails, country codes, dates, and statuses.
- Set-based prefetching for existing employee numbers/emails.
- Bulk PostgreSQL `insert_all` with `returning: [...]` to capture generated IDs for compensation records and rollback metadata.
- Single database transaction per batch.
Also optimize `ExportJobWorker` using database cursors to stream 10,000 records without memory ballooning.
```

#### Human Steering & AI Output Review:
- **AI Proposal:** Initially attempted raw SQL string concatenation (`INSERT INTO employees VALUES ('...'), ('...')`) to maximize raw speed.
- **Human Engineering Correction:** **Rejected raw string concatenation** due to SQL injection vulnerability and loss of automatic timestamp auditing. Instead, we directed the use of Rails 7.2's sanitized `insert_all(..., returning: [:id, :employee_number])`, achieving:
  - **10,000 rows imported in 7.47 seconds** (100x speedup).
  - **10,000 rows exported in 2.82 seconds** via cursor streaming (`batch_size: 1_000`).
  - Safe parameter sanitation and atomic `ImportRollbackService` integration.

---

### Phase 4: Deterministic 10,000 Synthetic Employee Benchmark Seed (Milestone 4)

#### Prompt Given to AI:
```markdown
Context:
Incubyte assessment requires: "Seed script with 10,000 employees. Tests that are fast, deterministic, and easy to understand."

Task:
1. Create a dedicated `BenchmarkSeedService` and Rake task `db:seed:benchmark`.
2. Generate exactly 10,000 synthetic employees with active compensation packages and components across 9 countries and currencies:
   - US (USD), UK (GBP), Germany (EUR), France (EUR), Japan (JPY), Canada (CAD), Australia (AUD), Singapore (SGD), India (INR).
3. Requirements:
   - Deterministic: use `srand(42)` so that names, emails, salaries, and departments are 100% reproducible across test runs.
   - Multi-tenant separation: seed into a dedicated benchmark organization ("Globex Corporation"), leaving "Acme Corporation" clean for demo and E2E browser tests.
   - Performance: use bulk `insert_all` chunking (completes in < 10 seconds).
   - Idempotency: running `rake db:seed:benchmark` repeatedly must detect existing data and skip in 0.0 seconds.
```

#### Human Steering & AI Output Review:
- **AI Output:** Cleanly implemented `BenchmarkSeedService`.
- **Human Engineering Verification:** Measured in Docker: 10,000 complete employee records with compensation packages and components seeded in **6.12 seconds**. Re-running skips in **0.01 seconds**. Added `spec/services/benchmark_seed_service_spec.rb` to lock in the 10,000-count guarantee.

---

### Phase 5: Workforce Analytics & Strict Currency Segregation (Milestone 4)

#### Prompt Given to AI:
```markdown
Context:
The HR Manager needs to answer questions about how the organization pays people across countries and departments.

Task:
1. Implement `GET /api/reports/workforce` and `GET /api/reports/compensation`.
2. Calculate headcount by country and department.
3. Calculate compensation metrics: total budget, average base salary, median, min, and max.
CRITICAL CONSTRAINT:
- Never sum or average amounts across different currencies!
- Group all compensation summaries strictly by `currency_code`.
- Implement single-pass SQL aggregation for sub-100ms response times on 10,000 rows.
```

#### Human Steering & AI Output Review:
- **AI Proposal:** Suggested converting all salaries to USD using a hardcoded exchange rate table to provide a "Total Company Payroll" KPI card.
- **Human Engineering Correction:** **Strictly Rejected.** Cross-currency summation without a real-time, dated FX compliance provider produces mathematically false metrics and violates the PRD. We enforced strict currency segregation at the SQL query level:
  ```sql
  SELECT currency_code,
         COUNT(*) as count,
         SUM(base_amount) as total,
         AVG(base_amount) as average,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY base_amount) as median,
         MIN(base_amount) as min,
         MAX(base_amount) as max
  FROM compensation_records
  WHERE tenant_id = ? AND effective_end_date IS NULL
  GROUP BY currency_code
  ```
  The React frontend renders individual currency cards with zero cross-currency pollution. Query completes in **84 milliseconds** on 10,000 rows.

---

### Phase 6: Operational Health Endpoints & Test Suite Hardening (Milestone 5)

#### Prompt Given to AI:
```markdown
Context:
Prepare the application for production deployment behind an AWS Application Load Balancer and ECS Fargate.

Task:
1. Implement 3 distinct health check endpoints in `HealthController`:
   - `GET /health/live`: Process liveness check (must not query the database, preventing container restart loops during transient DB load).
   - `GET /health/ready`: Dependency readiness check (validates database `SELECT 1` and Redis ping within 2-second timeout for ALB target routing).
   - `GET /health/workers`: Inspects Sidekiq worker heartbeat, active workers, processed/failed counts, and queue latencies.
2. Resolve E2E test isolation issues:
   - Ensure Playwright tests cleanup only Acme Corporation records and do not truncate Globex Corporation's 10,000 benchmark records.
```

#### Human Steering & AI Output Review:
- **AI Output:** Successfully implemented health endpoints and isolated test teardowns.
- **Human Engineering Correction:** Fixed an initial `NameError: uninitialized constant Sidekiq::ProcessSet` by adding explicit `require "sidekiq/api"` at the controller top, and hardened Playwright fixtures to filter deletions by `tenant_id = Acme`.

---

## 3. Engineering Judgment Matrix: AI Proposals vs. Human Decisions

| Area | Initial AI Proposal | Human Review & Steering Decision | Engineering Rationale |
| :--- | :--- | :--- | :--- |
| **System Scope** | Dynamic FX conversion engine & microservices | **Rejected** in favor of modular monolith & currency segregation | Avoided unnecessary complexity; aligned strictly with PRD. |
| **Multi-Tenancy** | Global connection `SET app.current_tenant_id` | **Rejected**; replaced with transaction-local `SET LOCAL` | Prevents dangerous tenant context leakage across pooled DB connections. |
| **Money Types** | `FLOAT` database columns | **Rejected**; enforced `DECIMAL(15,2)` and `BigDecimal` | Eliminates floating-point rounding errors in financial data. |
| **Salary Updates** | In-place overwrite of salary rows | **Rejected**; enforced immutable effective-dated revisions | Preserves complete audit trail of compensation changes over time. |
| **Compensation Typos** | Force new revision for typo fixes | **Decoupled**; added `PATCH /api/employees/:id/compensation/:cid` | Allows in-place fixes to active package without polluting historical revision records. |
| **Component Entry** | Blank component fields on edit | **Refactored** to pre-populate existing components + live total | Prevents accidental data loss; provides real-time annual package calculation. |
| **Dashboard Layout** | Narrow, cramped container | **Redesigned** to full-width fluid layout with Tailwind CSS | Modern enterprise look-and-feel with sticky headers and responsive tables. |
| **History Display** | Flat unstyled text list | **Redesigned** into chronological visual timeline with badges | Clear visual distinction between "Active" and "Historical" compensation packages. |
| **Action Confirmation** | Jarring browser `window.confirm()` | **Replaced** with branded in-app `ConfirmationModal` | Consistent UX with explicit destructive action warnings (rollback, delete). |
| **10k Bulk Import** | Row-by-row ActiveRecord callbacks (~14 min) | **Re-architected** with 500-batch `insert_all` (7.47s) | 100x performance speedup while maintaining rollback safety. |
| **Reporting** | Unified total payroll in USD | **Strictly Rejected**; grouped exclusively by currency | Eliminates mathematically invalid cross-currency sums. |
| **Health Checks** | Database check inside liveness probe | **Decoupled**; liveness checks process, readiness checks DB | Prevents cascading container restart loops during DB failovers. |

---

## 4. Key Takeaways for Evaluators

1. **AI as an Accelerator, Not a Driver:** AI was leveraged to rapidly generate boilerplate code, Tailwind components, and RSpec/Vitest/Playwright scaffolding.
2. **Staff-Level Architectural Governance:** Every critical boundary—RLS security, connection pool hygiene, financial precision, and algorithmic batching—was dictated and validated by human software craftsmanship.
3. **Verified Quality:** The combination of intentional prompt framing and rigorous verification delivered **323 automated tests (100% passing)** and **sub-8-second execution on 10,000 records**.
