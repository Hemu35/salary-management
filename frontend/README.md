# Frontend — Global Employee Compensation Management System

React 19 single-page application (SPA) built with Vite 8 for multi-tenant employee directory and compensation package management.

---

## Key Features

1. **Multi-Tenant Authentication & Session Context:**
   - Role-based UI behavior (`org_admin` across all domains, `hr_manager` scoped to assigned department).
   - Real-time domain filtering and scope switching in the top navigation bar.

2. **Employee Directory:**
   - Filterable, searchable, and paginated directory table.
   - Edit employee metadata, change department assignment, and manage lifecycle status.

3. **Compensation Package Management:**
   - **Active Package Overview:** Hero KPI summary showing total annualized compensation, base salary, and multi-currency badges.
   - **Dynamic Component Breakdown:** Multi-component packages (Base Salary, Performance Bonus, Commission, Allowances, Equity) with per-component frequency (Annual, Monthly, Bi-Weekly, Hourly).
   - **Pre-Populated Component Form:** When adjusting or editing an existing compensation structure, existing salary components are automatically pre-filled.
   - **Dual Revision Modes:**
     - **🔄 New Revision (Preserve History):** Effective-dated change that archives previous packages as `superseded` in the timeline audit log.
     - **✏️ In-Place Edit (Update Current):** Atomically updates the active package directly (e.g. adding an annual allowance or updating base salary) without generating redundant historical revisions.
   - **Fixed-Precision Math:** Live annualized totals computed using exact decimal factors (Monthly × 12, Bi-Weekly × 26, Hourly × 2080).

4. **Accessible & Responsive Modal Design:**
   - Standardized `.modal-card-lg` sizing and alignment matching across all forms.
   - Consistent action button dimensions (`min-width: 160px; height: 44px;`) across Cancel and Submit states.
   - Centered empty-state container with clear call-to-actions.

---

## Development & Test Commands

### Run Unit & Component Tests (Vitest)

```bash
npm run test -- --run
```

Or within Docker:

```bash
docker compose exec frontend npm run test -- --run
```

### Run End-to-End Browser Automation Tests (Playwright)

Make sure the local application stack is running on `http://localhost:3000`:

```bash
npx playwright test
```

To run a specific test suite:

```bash
npx playwright test e2e/compensation.spec.js
```
