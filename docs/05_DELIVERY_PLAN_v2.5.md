# **Delivery Plan**

**Global Employee Compensation Management System**

*Incubyte Assessment • Version 2.5*

## 1. Delivery Principles

- Implement incrementally with small, reviewable commits and tests alongside features.
- Keep the agreed P0 scope stable; record material scope or architecture changes in the decision log.
- Develop locally first; deploy after core flows and security tests are working.
- Do not claim AWS controls, backup recovery, or health routing are operational until configured and verified.
## 2. Milestones

| Milestone | Work items | Exit criteria |
| --- | --- | --- |
| M0 — Requirements/design | PRD, HLD, LLD, architecture diagram, assumptions and decision log | Documents agree on tenant/domain access, global currency/country scope, async CSV, RLS/KMS/health/backups. |
| M1 — Foundation | Rails/React setup, PostgreSQL, authentication, tenant context, roles/domains, migrations | Login works; tenant/domain authorization and RLS integration tests pass. |
| M2 — Core records | Employee CRUD, search/filter/pagination, compensation records/history, validations | Core flows and history tests pass on deterministic data. |
| M3 — Bulk workflows | Private file storage, async CSV import/export, Sidekiq/Redis, job status, retries, row errors | Import/export are asynchronous, scoped, observable and idempotent. |
| M4 — Insights and seed | Country/domain headcount, currency-grouped compensation reports, deterministic 10k seed | Reports correctly scope data and do not mix currencies. |
| M5 — Quality/security | Health endpoints, ALB/ECS checks, KMS/secrets/IAM, backup settings, audit/logging, tests | Configuration reviewed; relevant integration/deployment tests and evidence captured. |
| M6 — Deploy and submit | Deployment, smoke tests, demo recording, README, final artifacts, Git history/repo share | Deployed app and demo work; documentation and submission checklist complete. |

## 3. Suggested Commit Sequence

chore: bootstrap Rails API and React app

docs: add product requirements and architecture decisions

feat: add authentication and tenant context

feat: add domain-scoped HR authorization and RLS policies

feat: add employee CRUD, search, filters and pagination

feat: add compensation records and effective-dated history

feat: add asynchronous CSV import and job status

feat: add asynchronous CSV export and controlled downloads

feat: add workforce and currency-grouped compensation reports

test: add deterministic 10k seed and critical security tests

ops: add health checks, deployment configuration and recovery documentation

docs: add demo instructions, architecture, trade-offs and AI usage record

## 4. Submission Checklist

- One-page requirements document and design/architecture artifacts included.
- Git repository contains incremental commits and readable setup instructions.
- 10,000 deterministic synthetic employee seed works.
- Critical automated tests pass and commands are documented.
- Deployed application and demo video are accessible to reviewers.
- Architecture diagram, trade-offs, performance considerations, and AI prompts/usage notes are included.
- Any planned-but-not-implemented AWS controls are clearly marked as such.
