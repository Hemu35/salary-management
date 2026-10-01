# **Architecture and Product Decision Log**

**Global Employee Compensation Management System**

*Incubyte Assessment • Version 2.5*

## Decision Register

| ID | Decision | Reason / trade-off | Status |
| --- | --- | --- | --- |
| D-01 | Multi-tenant SaaS; shared application serves multiple organizations. | One deployable product; requires strict tenant isolation. | Agreed baseline |
| D-02 | Shared Amazon RDS for PostgreSQL schema with tenant_id for MVP. | Cost/simple operations; logical isolation reinforced by RLS and application authorization. | Agreed baseline |
| D-03 | PostgreSQL RLS as defense in depth. | Database policies reduce impact of accidentally unscoped application queries; tenant context/DB roles require careful design. | Implementation detail to validate |
| D-04 | Tenant identity comes from authenticated identity/session, not browser tenant_id. | Prevents user-controlled tenant switching. | Agreed baseline |
| D-05 | Domain-scoped HR Manager access within tenant; Organization Admin manages users/assignments. | Supports multiple HR teams managing different employee populations without weakening tenant boundary. | Agreed baseline; admin data-access policy to define |
| D-06 | Support multiple countries and currencies in employee/compensation records. | Supports global product direction; no unsupported currency aggregation. | Agreed baseline |
| D-07 | No FX conversion or statutory payroll calculations in MVP. | Requires rates, dates, jurisdictions and compliance rules beyond assessment scope. | Out of scope |
| D-08 | Rails modular monolith + React frontend. | Maintainable, fast assessment delivery; avoid premature service decomposition. | Agreed baseline |
| D-09 | React static build served from S3/CloudFront; Rails API behind ALB. | Avoids dedicated frontend compute; CDN delivers static assets. | Target design |
| D-10 | ECS Fargate for Rails API and separately scalable Sidekiq workers. | Managed container runtime and independent web/worker scaling. | Target design |
| D-11 | Sidekiq + Redis for async CSV jobs; no SQS/DLQ in MVP. | Sufficient job queue/retry/dead handling for current scope with fewer moving parts. | Agreed baseline |
| D-12 | CSV import and export are P0 and asynchronous. | Bulk work should not block normal HTTP requests; status and errors are visible. | Agreed baseline |
| D-13 | RDS/S3 encryption with KMS; secrets in Secrets Manager/SSM; least-privilege IAM. | Sensitive employee/compensation data needs explicit data-protection controls. | Target design; verify deployment |
| D-14 | Separate liveness and readiness checks; ALB uses readiness; worker health monitored separately. | Avoid DB-outage restart loops and keep unhealthy API targets out of traffic. | Target design; thresholds to configure |
| D-15 | RDS automated backups/PITR and S3 recovery/lifecycle; restore drills. | Backups require tested restoration, not just configured snapshots. | Target design; retention/RPO/RTO to confirm |
| D-16 | Dedicated or customer-managed database is a future isolation option, not MVP. | Supports enterprise isolation needs at additional routing, migration, secret, backup and operations cost. | Future option |
| D-17 | Organization Admin's access to employee/compensation records requires explicit policy. | Avoid implicit overbroad permissions. | Open implementation detail |
