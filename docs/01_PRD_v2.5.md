# **Product Requirements Document (PRD)**

**Global Employee Compensation Management System**

*Incubyte Software Craftsperson / Ruby on Rails – Staff • Version 2.5*

## 1. Executive Summary

Build a secure multi-tenant SaaS application that replaces spreadsheet-based employee and compensation tracking with a centralized web application. Multiple organizations can maintain employee records, compensation and salary history, import/export data, and view workforce and compensation insights.

Global product direction: the MVP supports employees and compensation records across multiple countries and currencies. The product should be extensible to additional markets. Country-specific payroll compliance, statutory calculations, and foreign-exchange conversion are outside the initial scope. The assessment uses exactly 10,000 deterministic synthetic employees. CSV import and export are P0 and run asynchronously.

## 2. Problem Statement

Spreadsheet-based employee and compensation management is difficult to search, validate, maintain historically, process in bulk, and report across countries and departments. HR teams need controlled access, reliable bulk workflows, and useful compensation visibility.

## 3. Product Goals

Provide secure tenant-isolated HR data management for multiple organizations.

Support multiple HR users per organization with access limited by assigned permissions and employee domains.

Centralize employee and compensation records across countries and currencies.

Preserve effective-dated compensation history.

Provide search, filtering, pagination, and workforce/compensation summaries.

Support asynchronous CSV import and export without blocking normal web requests.

Demonstrate reliable behavior with 10,000 deterministic synthetic employees.

Deliver automated tests, a deployed application, a demo video, and assessment documentation.

## 4. Users and Permissions

The MVP supports Organization Admin and HR Manager roles. An Organization Admin manages HR user accounts and access assignments. HR Managers manage employee and compensation records within their assigned domains/departments.

- An organization may have multiple HR users. Each user belongs to one tenant.
- An HR Manager may be assigned to one or more domains/departments within that tenant.
- Organization Admin may manage organization-wide access and assign domain-scoped access.
- Authorization is enforced server-side. Tenant identity is derived from the authenticated identity/session and is not trusted from browser-supplied tenant identifiers.
- Changing request parameters, employee IDs, tenant IDs, or domain IDs must not grant additional access.
- Employee directory, compensation history, reports, imports, exports, and file downloads must enforce the same tenant and user access scope.
## 5. P0 Scope

### 5.1 Authentication and Authorization

- Login/logout and protected application access.
- Organization Admin and HR Manager roles.
- Server-side tenant resolution and authorization.
- Domain-scoped access assignments for HR Managers.
- Prevention of cross-tenant and out-of-scope employee access.
### 5.2 Employee Management

- View employee list and details; create and update employee records.
- Search by employee number, name, or email.
- Filter by country, department/domain, and employment status.
- Pagination, validation, and useful error states.
### 5.3 Compensation Management

- Create and update compensation records with currency, pay frequency, base salary, components, and effective dates.
- Preserve previous compensation history and identify current versus historical records.
- Support multiple countries and currencies without implying automatic currency conversion.
### 5.4 CSV Import

- Authorized HR users can upload employee/compensation CSV data within their access scope.
- Import runs asynchronously and processes data in batches.
- Validate rows, persist valid records, and report row-level errors where practical.
- Expose queued, processing, completed, and failed states.
- Import jobs and all associated data/file access remain tenant- and permission-scoped.
### 5.5 CSV Export

- Authorized HR users can request employee/compensation exports within their access scope.
- Export runs asynchronously; generated files are stored temporarily in controlled file storage.
- Expose job status and provide an authorized download when ready.
- Export must not include records outside the user's tenant and assigned access scope.
### 5.6 Workforce and Compensation Insights

- Headcount by country and department/domain.
- Compensation summaries grouped by currency and relevant dimensions.
- Do not combine amounts across currencies without a defined conversion method.
- Use current effective compensation by default for current-state summaries.
### 5.7 Background Processing

- Asynchronous CSV import/export and other genuinely long-running tasks.
- Show job status and actionable failure information.
- Handle retries and terminal/dead jobs without silently losing job outcomes.
### 5.8 Assessment Deliverables

- Deterministic seed for exactly 10,000 synthetic employees.
- Meaningful automated tests for critical workflows.
- Deployed working application and demo video.
- PRD, HLD, LLD, architecture diagram, test plan, decision log, AI usage record, and README.
## 6. P1 Scope

- Saved views and advanced filters.
- Scheduled import/export and more detailed import reconciliation.
- Additional role types and finer-grained organization restrictions.
- Payroll-period records including deductions, employer contributions, and net pay.
- Country-specific compensation configuration.
- Expanded audit reporting and enterprise tenant administration.
## 7. Explicitly Out of Scope

- Payroll execution or salary disbursement; payroll-provider integration.
- Statutory tax/social-insurance calculations and country-specific legal compliance automation.
- Foreign-exchange conversion or consolidated cross-currency totals.
- Employee self-service portal; multi-level compensation approvals.
- Budget planning/forecasting; billing/subscription management.
- Enterprise SSO and custom customer domains.
- Dedicated tenant infrastructure as an MVP requirement; dedicated/customer-managed databases remain future deployment options.
## 8. Product-Level Non-Functional Requirements

- Support the 10,000-employee assessment dataset and multiple tenants with responsive normal CRUD/search/reporting workflows.
- Protect sensitive employee and compensation data; enforce tenant and user access boundaries for every protected operation.
- Maintain compensation history without silent data loss and provide clear validation, loading, empty, progress, and failure states.
- Long-running imports/exports must not block normal web requests; users can see job progress/outcomes.
- Deployed services must expose operational health status so unhealthy application instances can be detected and traffic can be directed to healthy instances.
- Provide a recovery approach for application releases, database data, and stored files; recovery controls and restore procedures must be documented and verified.
- Use synthetic assessment data only; keep behavior deterministic and testable.
- Support multi-country/multi-currency records while avoiding unsupported FX calculations or jurisdictional compliance claims.
## 9. Assumptions

- Initial user roles are Organization Admin and HR Manager; an organization can have multiple HR users.
- A user belongs to one tenant; an HR Manager can be assigned to multiple domains within that tenant.
- Initial tenant data storage uses a shared relational database with logical tenant separation; stronger isolation options may be added later.
- Target relational database is Amazon RDS for PostgreSQL.
- Redis supports background job processing; CSV import/export are asynchronous P0 workflows.
- Multi-country/multi-currency record support is in scope; FX conversion and statutory payroll calculations are not.
- Deployment provider/configuration may be finalized after local functionality is complete, while deployment and demo remain required deliverables.
## 10. Success Criteria

Multiple tenants use the same application without cross-tenant data exposure.

Multiple HR users within a tenant can be assigned access scopes and are restricted to authorized employee domains.

Employee and compensation workflows work across supported countries and currencies.

Compensation changes preserve effective-dated history.

Import/export run asynchronously, show job status, and enforce tenant/user scope.

10,000 seeded employees can be searched, filtered, paginated, and reported.

Unhealthy application instances can be identified by deployment health checks; recovery expectations are documented.

Critical tests pass deterministically; application is deployed and demonstrated.

## 11. Acceptance Criteria

Unauthenticated users cannot access protected tenant data.

Tenant A cannot read, modify, search, export, or report on Tenant B data.

An HR Manager cannot access employee records outside their assigned domains; Organization Admin can manage access assignments.

Exactly 10,000 deterministic synthetic employees can be seeded.

Employee CRUD, search, filters, and pagination work.

Compensation changes preserve effective-dated history and currency.

CSV import creates a background job and processes data asynchronously with visible status and validation outcomes.

CSV export creates a background job and provides a controlled download when complete.

Import/export jobs and files cannot access data outside the initiating user's tenant and permission scope.

Reports do not combine amounts across currencies without a defined conversion method.

Health status is available to deployment/orchestration checks, and unhealthy instances are not treated as ready for traffic.

Critical automated tests pass; deployment, demo, and documentation are complete.
