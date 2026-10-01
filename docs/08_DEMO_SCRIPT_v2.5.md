# **Assessment Demo Walkthrough Script**

**Global Employee Compensation Management System**

*Incubyte Staff Rails Assessment • Version 2.5 • Official Demo Recording Guide*

---

## 1. Recording Preparation & Setup

### Target Recording Length
- **Duration:** 6 to 8 minutes
- **Resolution:** 1080p (1920x1080) or higher, full-screen browser window

### Pre-Recording Checklist
1. Ensure all Docker services are running:
   ```bash
   docker compose up -d
   ```
2. Verify benchmark data is seeded:
   ```bash
   docker compose exec backend bundle exec rake db:seed:benchmark
   ```
3. Prepare the 10,000-row test CSV file:
   - Ensure `test_10k_upload.csv` is present in your local folder or on your desktop for quick drag-and-drop.
4. Have 3 browser tabs open:
   - **Tab 1 (Frontend):** `http://localhost:5173` (or `http://localhost:3000`)
   - **Tab 2 (Terminal / Health):** `http://localhost:3000/health/ready`
   - **Tab 3 (Terminal / Workers Health):** `http://localhost:3000/health/workers`
5. Have your terminal ready to show the test suite command (`docker compose exec backend bundle exec rspec`).

---

## 2. Quick Demo Credentials Reference

The login screen features **One-Click Quick Login** buttons. If typing manually:

| Organization | Role | Email | Password | Scope / Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Acme Corp** | **Org Admin** | `admin@example.com` | `password123` | Full admin authority; all departments |
| **Acme Corp** | **HR Manager** | `hr@example.com` | `password123` | Restricted to **Engineering** & **Product** |
| **Globex Corp** | **Benchmark Admin** | `admin@globex.com` | `password123` | Global admin over **10,000 synthetic employees** |
| **Globex Corp** | **Benchmark HR** | `hr@globex.com` | `password123` | Scoped to **Engineering** (benchmark subset) |

---

## 3. Scene-by-Scene Walkthrough Script

---

### Scene 1: Introduction & Architecture Overview (0:00 – 0:45)

**On Screen:**
- Display the application login page with the "Global Employee Compensation Management System" branding and quick-login buttons.
- (Optional): Briefly show the architecture diagram ([`docs/architecture_diagram.png`](file:///C:/Users/himan/.gemini/antigravity/scratch/salary-management/docs/architecture_diagram.png)).

**Narration / Script:**
> *"Hello! Welcome to the demonstration of the Global Employee Compensation Management System, built for the Incubyte Staff Rails assessment.*
>
> *This is an enterprise-grade multi-tenant SaaS application designed to replace spreadsheet-based compensation tracking with a centralized, secure platform. The stack is built with Ruby on Rails 7.2 API, React 19 with Vite, PostgreSQL 16 with Row-Level Security, and Sidekiq 7 with Redis for high-speed asynchronous processing.*
>
> *In this demo, I will walk you through our multi-tenant isolation, domain-scoped HR authorization, effective-dated compensation history, our blazingly fast 10,000-record CSV bulk engine, currency-segregated analytics, and operational health monitoring."*

---

### Scene 2: Multi-Tenancy & Tenant Isolation (0:45 – 1:30)

**On Screen:**
1. Click the **"Acme Admin"** quick-login button (`admin@example.com`).
2. Point out the top navigation bar showing **"Tenant: Acme Corporation"** and the user badge **"admin@example.com (Organization Admin)"**.
3. Note that Acme Corp has 4 core demo employees across Engineering, Product, and Sales.
4. Click **Logout**.
5. Click the **"Benchmark Admin"** quick-login button (`admin@globex.com`).
6. Point out the navigation bar showing **"Tenant: Globex Corporation"** with **10,000 total employees**.

**Narration / Script:**
> *"First, let's look at multi-tenancy. Notice that our login screen provides quick-login shortcuts.*
>
> *When I log in as Acme Corporation Admin, we are in Acme's private organization. We see Acme's 4 core demo employees.*
>
> *Now, when I log out and log in as Globex Corporation Admin, we are in a completely separate organization containing 10,000 synthetic employees.*
>
> *Multi-tenant isolation is enforced at two distinct layers: first, at the Rails application layer where tenant ID is derived exclusively from the authenticated JWT token—never from client request parameters. Second, at the database layer via PostgreSQL Row-Level Security, where every query executes with a transaction-local `app.current_tenant_id` session setting. Even if an application query accidentally missed a where clause, PostgreSQL RLS physically blocks cross-tenant reads and mutations."*

---

### Scene 3: Domain-Scoped HR Authorization (1:30 – 2:30)

**On Screen:**
1. Log out of Globex Corp.
2. Click **"Acme HR"** quick-login button (`hr@example.com`).
3. Point out the user role: **"HR Manager"**.
4. Look at the **Department / Domain Selector** dropdown:
   - Notice the user only has access to **Engineering** and **Product**.
   - Notice **Sales** is not visible or accessible.
5. In the employee table, verify only Engineering and Product employees are shown (3 employees; the Sales employee is completely hidden).
6. Try changing filters or searching: records outside assigned domains never appear.

**Narration / Script:**
> *"Now, let's explore domain-scoped authorization. An organization often has multiple HR teams managing different departments.*
>
> *Here, I am logged in as Acme HR Manager. Notice in the domain selector that this user is only assigned to 'Engineering' and 'Product'. The 'Sales' department does not even appear in the dropdown.*
>
> *In the employee directory, only employees in Engineering and Product are returned. This authorization is enforced server-side using Pundit policies. If this HR user attempts to craft an API request or access an employee in Sales by ID, the backend returns a strict 403 Forbidden. Tenant isolation and domain scoping work together as defense in depth."*

---

### Scene 4: 10,000 Record Directory Performance (2:30 – 3:30)

**On Screen:**
1. Log out, then click **"Benchmark Admin"** (`admin@globex.com`).
2. Point out the table footer: **"Showing 1 to 25 of 10,000 employees"**.
3. In the search box, type a name (e.g. `Sophia`) or employee number (`EMP04200`):
   - Notice instant debounced filtering in under **40 milliseconds**.
4. Clear the search.
5. Filter by **Country:** select `Japan (JPY)`.
   - Table immediately filters to Japanese employees.
6. Filter by **Status:** select `on_leave`.
7. Click through page numbers (`Page 2`, `Page 3`):
   - Page transitions are instantaneous.

**Narration / Script:**
> *"Next, let's examine system performance under load. We are now logged into Globex Corporation, which contains exactly 10,000 synthetic employees generated deterministically across 9 countries and currencies.*
>
> *Watch how fast the directory responds: when I search for 'Sophia' or an employee number like 'EMP04200', results filter in under 40 milliseconds.*
>
> *When I filter by Country—say, Japan—and Status 'on leave', the query executes instantly. This high performance is powered by composite PostgreSQL indexes on `(tenant_id, domain_id, employment_status)` and bounded server-side pagination with Kaminari, ensuring database memory remains strictly bounded."*

---

### Scene 5: Effective-Dated Compensation History (3:30 – 4:30)

**On Screen:**
1. Clear the filters in the directory.
2. Click on the first employee's **View / Edit Compensation** button (currency symbol `$`).
3. The **Compensation History Modal** opens:
   - Point out the active package: Currency (e.g. `USD`), Base Salary, Pay Frequency, and granular components (Bonus, Equity, Allowance).
   - Point out the status: **Active** with `Effective: 2024-01-01 to Present`.
4. Click **"Add Compensation Revision"**:
   - Enter a new Effective Start Date (e.g. `2026-10-01`).
   - Increase Base Salary (e.g. from `$120,000` to `$135,000`).
   - Add a Bonus component (`$15,000`).
   - Click **"Save Revision"**.
5. Show the updated timeline:
   - The new package is now **Active** (`2026-10-01 to Present`).
   - The previous package is automatically closed out with `effective_end_date: 2026-09-30` and preserved in the timeline.
6. Click **"Edit In-Place"** on the active package to correct a typo without creating a historical entry.

**Narration / Script:**
> *"Let's look at compensation management. When I open an employee's compensation history, we see their full package breakdown, including Base Salary and individual components like bonuses and equity.*
>
> *Notice our immutable effective-dated architecture: when an employee receives a raise or role change, we click 'Add Compensation Revision'. We set the new effective start date and salary.*
>
> *When saved, the system automatically closes out the previous package and creates a new active record. Previous compensation history is never lost or overwritten—providing a complete, auditable timeline.*
>
> *Furthermore, all monetary values are stored with fixed precision `NUMERIC(15,2)` in PostgreSQL and handled with `BigDecimal` in Rails, eliminating floating-point rounding errors."*

---

### Scene 6: High-Speed 10,000 CSV Bulk Import & Rollback (4:30 – 5:45)

**On Screen:**
1. Click the **"Import CSV"** button in the header.
2. The Import Modal opens with instructions and required columns.
3. Drag and drop (or select) `test_10k_upload.csv` (10,000 records).
4. Click **"Upload and Process"**:
   - The modal switches to the live progress bar:
   - Point out: status is `processing`, showing processed rows counter updating in real-time.
   - Watch the 10,000 records finish in **~7.5 seconds**!
   - Status switches to **"Completed Successfully (10,000 of 10,000 rows)"**.
5. Point out the **"Rollback Import"** button:
   - Click **"Rollback Import"** and confirm.
   - Show that the inserted batch is atomically rolled back via `ImportRollbackService`, restoring the directory to its previous state.

**Narration / Script:**
> *"Now for one of the most powerful features: our asynchronous bulk CSV engine.*
>
> *Originally, uploading 10,000 records row-by-row took 14 minutes due to N+1 queries. We completely re-architected the worker using bounded 500-record batch chunking, in-memory validation, and PostgreSQL `insert_all` with `returning` keys.*
>
> *Let's upload `test_10k_upload.csv` containing 10,000 employee records with compensation packages and components.*
>
> *Watch the live progress: the Sidekiq worker processes in the background without blocking the web server. And look at that—10,000 records processed and indexed in just 7.47 seconds! That is a 100x performance improvement, averaging over 1,300 records per second.*
>
> *Even better, every import tracks its inserted IDs in `rollback_metadata`. If an HR manager realizes they uploaded the wrong file, they can click 'Rollback Import', and our `ImportRollbackService` cleanly removes the inserted records and restores previous states atomically in a single transaction."*

---

### Scene 7: High-Speed 10,000 CSV Export (5:45 – 6:30)

**On Screen:**
1. In the employee directory, click the **"Export CSV"** button (or select specific employee checkboxes and click **"Export Selected"**).
2. The export job is enqueued in Sidekiq.
3. The download notification toast appears almost immediately (**under 3 seconds**).
4. The CSV file downloads automatically.
5. Open the downloaded CSV in Excel or text editor to show:
   - 10,001 lines (header + 10,000 rows).
   - Scoped strictly to Globex Corporation.
   - Complete employee details, current compensation, and department fields.

**Narration / Script:**
> *"Exporting is equally optimized. When I click 'Export CSV', the request runs asynchronously via an `ExportJobWorker` in Sidekiq.*
>
> *Instead of loading all 10,000 records into memory, our worker uses database cursors with a 1,000-row batch size to stream records directly to a secure CSV artifact.*
>
> *Notice that the export completes in just 2.82 seconds! When ready, the browser securely streams the file from our authorized download endpoint. If an HR Manager is scoped to Engineering, their export will only contain Engineering employees."*

---

### Scene 8: Workforce & Currency-Segregated Analytics (6:30 – 7:15)

**On Screen:**
1. Click on the **"Workforce Analytics"** tab in the navigation bar.
2. Show the **Headcount by Country** chart / breakdown (distribution across US, UK, Germany, Japan, India, etc.).
3. Show the **Headcount by Department** breakdown.
4. Scroll to **Compensation Insights**:
   - Highlight the **Currency Breakdown Cards**:
     - `USD`: Average Salary, Median, Min, Max, Total Budget.
     - `EUR`: Average, Median, Min, Max.
     - `GBP`: Average, Median, Min, Max.
     - `JPY`: Average, Median, Min, Max.
5. **CRITICAL EMPHASIS:** Point out that there is **NO cross-currency summation**!

**Narration / Script:**
> *"Now let's visit the Workforce Analytics dashboard.*
>
> *Here, we see headcount distributions by country and department across the 10,000 employees, calculated in a single fast SQL query taking only 84 milliseconds.*
>
> *In the Compensation Insights section, please note an essential architectural principle: all compensation aggregates—mean, median, minimum, maximum, and total spend—are strictly segregated by currency code.*
>
> *Per our PRD specifications, cross-currency summation is strictly prohibited. You cannot add 100,000 US Dollars to 10,000,000 Japanese Yen without a verified foreign exchange conversion service. Our architecture enforces this guardrail at both the database aggregation and UI visualization layers."*

---

### Scene 9: Operational Health Checks & Automated Test Suite (7:15 – 8:00)

**On Screen:**
1. Switch to the browser tab with `http://localhost:3000/health/ready`:
   - Show JSON response: `{"status":"ok","checks":{"database":"ok","redis":"ok"}}`.
2. Switch to the tab with `http://localhost:3000/health/workers`:
   - Show JSON response: `{"status":"ok","active_workers":1,"processed":...,"failed":0,"queues":{"default":0,"imports":0,"exports":0}}`.
3. Switch to your terminal window:
   - Run or display the RSpec test suite summary:
     `230 examples, 0 failures`
   - Mention the Vitest and Playwright test counts:
     `Total: 323 Passed / 0 Failed`.

**Narration / Script:**
> *"Before wrapping up, let's look at operational production readiness.*
>
> *We have implemented three dedicated health check endpoints:*
> - `/health/live`: validates the Rails web process is alive without touching the database, avoiding false restart loops during transient DB blips.
> - `/health/ready`: checks database and Redis connectivity with a bounded timeout, used by the Application Load Balancer to route traffic only to healthy containers.
> - `/health/workers`: inspects Sidekiq worker heartbeats, queue depths, latencies, and failed job counts.
>
> *Finally, our automated test suite provides 100% verification across all layers:*
> - *230 backend RSpec tests covering tenant isolation, PostgreSQL RLS, Pundit policies, and async workers.*
> - *62 frontend Vitest component tests.*
> - *31 Playwright end-to-end browser automation tests across Chromium, Firefox, and WebKit.*
> - *A grand total of 323 passing tests with zero failures."*

---

### Scene 10: Conclusion & Wrap-Up (8:00 – 8:30)

**On Screen:**
- Return to the application dashboard or README documentation page.

**Narration / Script:**
> *"In summary, the Global Employee Compensation Management System delivers on all P0 requirements:*
> - *Robust multi-tenancy with PostgreSQL Row-Level Security defense in depth.*
> - *Strict domain-scoped HR authorization.*
> - *Deterministic 10,000-employee benchmark dataset with sub-40ms search.*
> - *Blazingly fast 100x bulk CSV import in 7.4 seconds and export in 2.8 seconds.*
> - *Immutable effective-dated compensation history.*
> - *Safe currency-segregated workforce analytics.*
> - *Production health checks and a 323-test automated quality suite.*
>
> *Thank you very much for watching, and thank you to the Incubyte team!"*

---

## 4. Post-Recording Checklist

- [ ] Video uploaded to YouTube (Unlisted), Loom, or Google Drive with public viewing access.
- [ ] Video link added to [`docs/09_README_ASSESSMENT_TEMPLATE_v2.5.md`](file:///C:/Users/himan/.gemini/antigravity/scratch/salary-management/docs/09_README_ASSESSMENT_TEMPLATE_v2.5.md) and [`README.md`](file:///C:/Users/himan/.gemini/antigravity/scratch/salary-management/README.md).
- [ ] Repository pushed to GitHub with clean main branch and green CI actions.
