# AI Prompts, Architecture & Documentation Design Pack

**Enterprise Software Craftsperson / Rails Assessment**  
**Project:** Employee Salary & Compensation Management  
**Purpose:** Reusable prompts for producing and reviewing the assessment’s product, architecture, engineering, and submission documents.

> **Evidence rule:** This is a prompt pack and documentation workflow, not proof that every prompt was used or every design element was implemented. Record actual prompts, AI outputs, human edits, commands, test results, deployment details, and decisions in the AI usage log. Do not claim a metric, test count, commit, security control, deployment, or recovery capability unless you can verify it.

---

## 1. Shared context and rules for every prompt

Use this context at the beginning of each AI-assisted design or documentation task.

```text
You are assisting with the Enterprise Software Craftsperson / Rails assessment.

Assessment brief:
Build functional employee salary-management software for an organization with
10,000 employees across multiple countries. HR currently manages salary data in
spreadsheets and needs a web application to maintain employee/compensation data
and answer questions about how the organization pays people.

Assessment deliverables include:
- A concise requirements document created before implementation.
- Functional backend and UI.
- Rails is preferred; use a relational database.
- React or Next.js UI.
- A seed script for 10,000 employees.
- Deployed working software and a demo video.
- Meaningful, fast, deterministic, understandable tests.
- Readable, maintainable code and incremental Git commits.
- Planning/design notes, architecture diagram, prompts/instructions used with AI,
  trade-offs, and performance considerations.
- A Git repository shared with the assessor.

Current product baseline:
- The product manages employee and compensation records; it is not a payroll
  execution or salary-disbursement system.
- Support multiple countries, currencies, compensation frequency, and
  effective-dated compensation history.
- Do not add foreign-exchange conversion, statutory payroll calculations, or
  legal-compliance automation to the MVP.
- Keep compensation summaries separated by currency and, where relevant,
  pay frequency. Never add unlike currencies into one total.
- Use deterministic synthetic data only; do not use real personal information.
- The current consolidated PRD is the requirements baseline. If an older
  document conflicts with it, identify the conflict rather than silently choosing.
- Features identified as scope refinements must not be described as original
  assessment requirements.
- Treat AWS architecture, security controls, performance targets, and recovery
  procedures as proposed until implementation and verification evidence exists.

Working assumptions/design direction (confirm against current decisions):
- Rails modular monolith backend and React frontend.
- Relational database; PostgreSQL is the target for deployment/integration
  validation. A lightweight local database may be used only if its limitations
  are documented and PostgreSQL-specific behavior is tested against PostgreSQL.
- Asynchronous CSV import/export may use Sidekiq and Redis if those are the
  selected implementation choices.
- Multi-tenant and department/domain-scoped access are in the refined product
  scope. Tenant identity must come from trusted server-side authentication
  context, never an untrusted browser-supplied tenant_id.
- Organization Admin management permissions and compensation-data visibility
  are separate questions. Do not infer salary visibility from the ability to
  administer users/departments; record the policy as an explicit decision.
- Department and domain are synonymous in the current product language.

Prompting and output rules:
1. Separate confirmed requirements, assumptions, open decisions, proposed design,
   implemented behavior, and verified evidence.
2. Do not invent stakeholder answers, API endpoints, schema fields, test results,
   URLs, commit hashes, benchmark results, or implementation status.
3. Ask focused questions only when an ambiguity materially changes scope,
   security, data integrity, or architecture. Otherwise list an assumption and
   continue.
4. Prefer the simplest design that meets the assessment. Explain why alternatives
   were not selected; avoid premature microservices or unnecessary infrastructure.
5. Make outputs consistent with the current PRD and with each other.
6. Mark unresolved choices as OPEN and name the decision owner or the point in
   the workflow when the decision must be made.
7. Do not state that security, isolation, performance, deployment, backup, or
   restore requirements are satisfied merely because they appear in a design.
8. Produce concise, reviewable documents. Keep PRD at product level; put system
   structure in HLD, detailed contracts/data rules in LLD, and verification in
   the test plan.
```

---

## 2. Prompt: Review and normalize the requirements baseline

```text
Review the attached assessment brief and the latest PRD.

First extract the assessment's explicit requirements without adding features.
Then separately list:
A. explicit assessment requirements,
B. product requirements added/refined in the current PRD,
C. assumptions,
D. open decisions,
E. out-of-scope items.

Identify contradictions between the assessment brief, current PRD, older PRDs,
and any supplied design documents. Do not silently reconcile them.

Return:
1. a concise requirements traceability table with columns:
   Requirement ID | Requirement | Source (assessment / PRD refinement /
   assumption) | Priority | Acceptance evidence | Related documents;
2. a list of contradictions and recommended document updates;
3. a list of unresolved decisions that block implementation or testing.

Use the exact terminology in the source. Do not claim a requirement is
implemented.
```

---

## 3. Prompt: Draft or revise the one-page PRD

```text
Using the assessment brief and current approved product decisions, draft a
concise, one-page Product Requirements Document for Employee Salary &
Compensation Management.

Include:
- Problem statement and product goal.
- Primary user/personas and their goals.
- P0 scope, P1 scope, and deliberately excluded features, with brief rationale.
- Core workflows and product-level acceptance criteria.
- Product-level non-functional requirements: privacy/access control, integrity
  of compensation history, usability with 10,000 synthetic employees,
  understandable errors, and maintainability/testability.
- Assumptions and open decisions.

Requirements to reflect when confirmed in the current baseline:
- Employee directory and employee record management.
- Compensation records with currency, pay frequency, components, effective dates,
  current/historical views, and as-of behavior.
- Multiple countries and currencies without FX conversion or mixed-currency totals.
- Reports such as headcount and compensation summaries grouped by meaningful
  dimensions and currency.
- Authentication/authorization and tenant/department boundaries as specified
  by the current PRD.
- CSV import/export priority and behavior as specified by the current PRD.
- Deterministic synthetic seed of 10,000 employees and assessment deliverables.

Do not put database tables, endpoint paths, framework internals, cloud topology,
SQL/RLS policy syntax, class names, or detailed job implementation in the PRD.
Do not assume Organization Admins can view salary data; flag that policy as open
unless an approved decision is supplied.

Output only the PRD, followed by a short assumptions/open-decisions section.
```

---

## 4. Prompt: Create the High-Level Design (HLD)

```text
Create or update the High-Level Design for the application, using the approved
PRD as the source of product scope.

Describe:
1. Architecture goals and constraints.
2. Logical components and responsibilities (web UI, Rails application,
   relational database, background processing, file storage, identity, and
   observability as applicable).
3. Deployment topology only to the level actually selected. Label cloud services
   as TARGET/PROPOSED unless deployment evidence is supplied.
4. Main request/data flows:
   - sign-in and authenticated application request;
   - employee and compensation read/write;
   - tenant and department authorization;
   - asynchronous import, including status and row-level outcomes;
   - asynchronous export and authorized download;
   - reporting;
   - job failure/retry and recovery.
5. Trust boundaries and security controls, including trusted tenant resolution,
   least privilege, sensitive-data logging restrictions, and any database
   isolation defense-in-depth.
6. Scaling/performance considerations for 10,000 employees and bulk files.
7. Availability, health checks, backup/restore, and operational considerations.
8. Alternatives and trade-offs; avoid unnecessary microservices or cloud
   complexity for the assessment.
9. Assumptions, open decisions, and items requiring implementation evidence.

For every design statement, label it as one of:
- Requirement
- Approved decision
- Proposed design
- Open decision
- Implemented and verified (only when evidence is supplied)

Do not invent capacity numbers, latency objectives, RPO/RTO, retention periods,
cloud configuration, or operational readiness. Where a measurable target is
needed but not agreed, propose a target for review and mark it PROPOSED.

End with a concise “HLD consistency checklist” against the PRD.
```

---

## 5. Prompt: Create the Low-Level Design (LLD)

```text
Create or update the Low-Level Design from the approved PRD and HLD. Keep the
LLD implementation-oriented but do not invent details that conflict with the
repository or approved decisions.

Cover:
- Proposed relational entities and relationships, tenant ownership, keys,
  uniqueness, foreign keys, indexes, money precision, and effective-date rules.
- Authentication/session strategy and authorization sequence.
- Tenant and department/domain scoping for records, reports, jobs, uploaded
  files, generated files, and downloads.
- Compensation creation, revision, correction, date-overlap, current/as-of, and
  history behavior.
- CSV import contract: template/columns, validation, duplicate matching,
  partial success, idempotency, batch boundaries, retries, cancellation/rollback,
  error reporting, and file handling. Mark undecided policies OPEN.
- CSV export contract: selected fields, scope revalidation, asynchronous status,
  storage, expiry/retention, and download authorization. Mark undecided policies
  OPEN.
- Reporting definitions, grouping dimensions, effective-date semantics, and
  currency/pay-frequency safeguards.
- Background job states, retry/terminal failure behavior, and observability.
- API contract: method/path, request/response shape, status codes, authorization,
  validation errors, pagination, and idempotency where relevant. Verify routes
  against the code before calling them implemented.
- Transaction boundaries, concurrency considerations, and data-integrity rules.
- Error handling and sensitive-data logging rules.

If PostgreSQL RLS is selected, specify its intended role as defense in depth,
trusted transaction-local tenant context, runtime DB-role restrictions, and
integration tests. Do not claim RLS is active unless migration/configuration and
tests are provided.

Finish with:
1. unresolved implementation decisions,
2. test cases derived from the rules,
3. a PRD-to-LLD traceability table.
```

---

## 6. Prompt: Design the architecture diagram

```text
Create a clean architecture diagram that matches the current HLD. Show only
components and flows that are in the approved target design; distinguish
implemented components from proposed components using a legend.

Include, where applicable:
- HR user/browser and React UI.
- Edge/static asset delivery.
- API ingress/load balancer if part of the selected deployment.
- Rails application/API.
- Authentication/authorization boundary.
- Relational database and tenant-isolation boundary.
- Background worker and queue/cache.
- Private upload/export object storage.
- Monitoring/logging and security/secret services.
- Backup/recovery path.

Show arrows for:
1. browser to UI/API,
2. authenticated request to Rails,
3. Rails to database,
4. Rails to queue and worker,
5. worker to database and file storage,
6. authorized result/download path,
7. monitoring and recovery paths where relevant.

Diagram rules:
- Keep labels readable and avoid crowded internal table/schema details.
- Do not put example department assignments or sensitive data in the diagram.
- Do not show a service as deployed if it is only a proposal.
- Use the exact database/service names selected in the HLD; do not substitute
  Aurora for RDS PostgreSQL or add SQS if not selected.
- Include a legend and a short notes section for tenant isolation, department
  authorization, and any future dedicated-database option.
- Return editable Mermaid source plus a rendered diagram if the tool supports it.
```

---

## 7. Prompt: Build the test plan and traceability matrix

```text
Create a test plan from the current PRD, HLD, and LLD.

Organize tests by unit/domain, request/integration, UI/component, end-to-end,
security, background jobs, seed/data integrity, and performance.

Include cases for:
- Authentication, session expiration/logout, and unauthenticated access.
- Cross-tenant denial and department/domain scope enforcement.
- Organization Admin permissions, including the separately decided salary-data
  visibility policy.
- Employee CRUD, validation, search, filters, pagination, inactive/terminated
  records, and duplicate handling.
- Compensation decimal precision, currency/frequency validation, effective-date
  boundaries, overlapping periods, revision, correction, and history.
- Reports grouped by currency/pay frequency and no mixed-currency arithmetic.
- CSV import valid/invalid rows, duplicate/matching policy, partial success,
  retries/idempotency, batch failure, cancellation/rollback if supported,
  unauthorized job status/error-file access, and 10k input.
- CSV export scope at request and download time, job failure, expiry, and
  unauthorized download.
- Job state transitions, retries, terminal failure, and user-visible errors.
- Deterministic seed count/repeatability and synthetic-only data.
- Liveness/readiness behavior and recovery tests only where those features exist.
- Performance scenarios with dataset size, environment, measurement method,
  and agreed thresholds.

For each case include ID, setup/data, action, expected result, test level,
automation status, and evidence location.

Do not invent passing results or claim coverage percentages. Mark tests as
PLANNED until execution evidence is provided. Separate PostgreSQL-specific
integration tests from SQLite-only tests.
```

---

## 8. Prompt: Maintain the Architecture / Product Decision Log

```text
Create or update a decision log for material product and technical choices.

For each decision record:
- ID and date (if known);
- decision/question;
- context and constraints;
- options considered;
- selected option or OPEN status;
- rationale and trade-offs;
- consequences/security/performance implications;
- related PRD/HLD/LLD sections;
- evidence or revisit trigger;
- decision owner, if known.

Include topics where relevant:
- Rails modular monolith vs service decomposition;
- React vs Next.js;
- relational database and local-vs-deployment database choice;
- tenant isolation and department authorization;
- Organization Admin salary-data visibility;
- session/token identity strategy;
- PostgreSQL RLS decision and implementation constraints;
- async job system and file storage;
- CSV duplicate/partial-failure/idempotency behavior;
- currency-safe reporting;
- deployment simplicity/cost;
- backup, restore, retention, RPO/RTO.

Do not mark a proposal as “Agreed” without an explicit decision. Do not mark a
control as implemented merely because it is selected in the design.
```

---

## 9. Prompt: Create the delivery plan

```text
Create a milestone plan that sequences work from requirements to a verifiable
submission. Prioritize assessment requirements and security/data-integrity
foundations before optional refinements.

For each milestone list:
- objective and scope;
- dependencies;
- implementation tasks;
- tests/evidence required;
- exit criteria;
- documentation to update;
- risks and open decisions.

Include incremental, reviewable Git commits and keep PRD, HLD, LLD, diagram,
test plan, decision log, README, and AI usage log synchronized as decisions
change.

Separate:
- local functional completion,
- integration/security validation,
- deployment,
- operational verification,
- demo and submission.

Do not imply deployment, AWS controls, backup/restore, or performance targets
are complete until evidence exists. Keep the plan realistic for an individual
assessment and identify optional work that can be deferred.
```

---

## 10. Prompt: Prepare the README from verified implementation

```text
Draft a repository README using only verified information supplied from the
repository and environment.

Include:
- project purpose and implemented feature list;
- actual technology and version details;
- prerequisites;
- exact setup, migration, seed, backend, frontend, worker, and test commands;
- environment variable names without secret values;
- demo credentials only if safe and intentionally provided;
- deployed URL and demo link only if confirmed;
- architecture diagram/document links;
- known limitations and design trade-offs;
- test commands and latest actual results;
- deployment, health, backup, and recovery details only to the extent verified.

Use TODO/NOT YET VERIFIED for missing information. Do not copy target architecture
components into the implemented-feature list unless they exist in the code or
deployment. Do not claim PostgreSQL RLS validation based only on SQLite tests.
```

---

## 11. Prompt: Record actual AI usage and human review

```text
Turn the supplied contemporaneous notes into an AI usage log. Do not fabricate
prompts, dates, tool/model names, code changes, test results, or human review.

For each actual AI-assisted task record:
- date (if known);
- task and relevant file/commit;
- tool/model (if known);
- exact prompt or clearly labeled faithful summary;
- output accepted, modified, or rejected;
- human review and changes;
- verification performed (commands/tests/manual checks);
- unresolved issue or follow-up.

If a detail is missing, mark it UNKNOWN or ask for it. Distinguish an example
prompt from a prompt actually used. Never say “verified” without the verification
evidence.
```

---

## 12. Prompt: Cross-document consistency and submission audit

```text
Audit the supplied current PRD, HLD, LLD, architecture diagram, test plan,
decision log, delivery plan, README, and AI usage log as one document package.

Use the current PRD as the product baseline, while preserving the distinction
between original assessment requirements and later refinements.

Check for:
- conflicting P0/P1/out-of-scope decisions;
- inconsistent role names, department/domain terminology, or admin permissions;
- tenant identity and access scope differing between documents;
- mismatched database, queue, storage, authentication, or deployment choices;
- CSV import/export rules that differ across PRD, LLD, tests, and UI;
- inconsistent compensation history, currency, and pay-frequency semantics;
- architecture diagrams that show unselected or unimplemented services;
- tests that do not cover stated acceptance criteria;
- README claims without implementation evidence;
- unverified performance, security, deployment, backup, or recovery claims;
- duplicate or outdated documents that could confuse an assessor;
- missing links, commands, demo details, and submission artifacts.

Return:
1. a severity-ranked issue list (Blocker / Important / Editorial);
2. exact document and section to change;
3. proposed replacement wording or action;
4. evidence needed to close each issue;
5. a final checklist with statuses NOT STARTED / IN PROGRESS / VERIFIED.

Do not declare the package ready if any blocker remains or if required evidence
is missing. Do not rewrite source facts to make documents appear consistent;
surface conflicts for a human decision.
```

---

## 13. Human review checklist

Before accepting AI-generated architecture or documentation:

- [ ] Requirements are traceable to the assessment or an explicitly approved refinement.
- [ ] PRD describes product behavior, not implementation internals.
- [ ] HLD, LLD, diagram, and test plan agree on the selected architecture.
- [ ] Open decisions are visible and not represented as settled facts.
- [ ] Tenant and department access rules are consistent across every workflow.
- [ ] Admin access to compensation data is explicitly decided.
- [ ] Currency, precision, effective dates, and history rules are unambiguous.
- [ ] Import/export scope, failure, retry, idempotency, and retention are defined.
- [ ] Security and recovery statements are supported by implementation evidence.
- [ ] Performance claims include dataset, environment, method, and measured result.
- [ ] README commands and URLs have been run/checked.
- [ ] AI usage log reflects actual work and human verification.
- [ ] Old/conflicting drafts are clearly archived or excluded from submission.
