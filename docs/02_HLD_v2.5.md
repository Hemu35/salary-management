# **High-Level Design (HLD)**

**Global Employee Compensation Management System**

*Incubyte Assessment • Architecture baseline • Version 2.5*

## 1. Purpose and Architecture Summary

This HLD describes a multi-tenant SaaS application for employee and compensation management across organizations, countries, and currencies. The MVP is a modular Rails application with a React frontend, asynchronous Sidekiq workers, Amazon RDS for PostgreSQL, and AWS-managed delivery, security, storage, and operations services.

This is a target design. AWS resources and controls described here must be implemented, configured, and verified before being represented as deployed capabilities.

## 2. Architecture Principles

- One shared application serves multiple customer organizations (tenants); every business operation enforces tenant isolation.
- Within a tenant, HR users may be restricted to assigned employee domains/departments. Domain authorization is distinct from tenant isolation.
- Use a modular monolith for the assessment; scale Rails web tasks and Sidekiq workers independently.
- Use asynchronous processing for CSV import/export and other long-running work; normal CRUD/search remains synchronous.
- Keep employee and compensation data in RDS; use S3 for uploaded/generated files; Redis is queue infrastructure, not a system of record.
- Support multi-country/multi-currency records without implying automatic FX conversion or statutory payroll calculations.
- Prefer managed AWS services and infrastructure-as-code; configure recovery and health monitoring as operational requirements.
## 3. Logical and Deployment Components

| Layer | Component | Responsibility |
| --- | --- | --- |
| Client | React web application | HR workflows: employee/compensation management, search, reports, CSV job status and downloads. |
| Edge | Route 53 | DNS for application domain. |
| Edge | CloudFront + S3 | Deliver React static assets; S3 origin access restricted to CloudFront. |
| Edge/security | AWS WAF + ACM | Web request filtering and TLS certificate management. |
| API ingress | Application Load Balancer | Routes API requests to healthy Rails targets; target health checks. |
| Application | Rails API on ECS Fargate | Authentication/authorization, tenant context, domain permissions, business logic, reporting, job creation. |
| Background | Sidekiq ECS service + Redis/ElastiCache | Asynchronous imports/exports; retry and failed-job handling. |
| Identity | Cognito or approved OIDC/custom auth | Authentication and identity; Rails remains responsible for application authorization. |
| Data | Amazon RDS for PostgreSQL | Relational system of record; shared schema and tenant_id isolation; RLS defense in depth. |
| Files | Amazon S3 | CSV uploads, generated exports, row-error artifacts with tenant-scoped access and lifecycle. |
| Security | AWS KMS, Secrets Manager/SSM, IAM | Encryption key management, secret storage, least-privilege AWS access. |
| Operations | CloudWatch, CloudTrail, Systems Manager | Logs/metrics, AWS activity audit, operational management. |
| Delivery | Git, CI/CD, ECR, CDK/CloudFormation | Versioned builds, repeatable infrastructure deployment, rollback support. |

## 4. Request and Data Flows

### 4.1 Frontend and API traffic

HR user loads the React application from S3 through CloudFront; the S3 origin is not publicly writable and should be restricted to the CDN access path.

Browser API requests enter through the protected edge path (CloudFront/WAF as configured) and reach the Application Load Balancer.

ALB forwards requests only to healthy Rails API tasks running on ECS Fargate across Availability Zones.

Rails authenticates the user, derives tenant context from the authenticated identity, applies role/domain authorization, and executes tenant-scoped business logic.

Rails reads or writes RDS records and returns a response. Sensitive values are excluded from logs.

### 4.2 Asynchronous CSV import/export

Rails validates the request and stores/references the uploaded file in S3; it creates a tenant- and requester-associated job record.

Rails enqueues the job through Sidekiq/Redis and returns a job identifier and current status.

A separate Sidekiq ECS service processes records in bounded batches, enforcing tenant and domain scope, validation, idempotency, and retry rules.

Import outcomes are stored in RDS. Export artifacts are stored in S3 with controlled, expiring access.

Authorized users poll job status and retrieve permitted results. SQS/DLQ is not part of the MVP.

## 5. Multi-Tenancy and Authorization

Default MVP storage is one Amazon RDS for PostgreSQL database with a shared schema. Tenant-owned records carry tenant_id. Rails derives tenant context from the authenticated user/session; browser-supplied tenant identifiers are not authorization inputs.

PostgreSQL Row-Level Security (RLS) is a planned defense-in-depth control. Application authorization remains mandatory. Tenant context must be applied safely for each transaction/connection, and the application database role must not have BYPASSRLS privileges. Domain-scoped HR access is enforced in application policy/query logic and applies only inside the authenticated tenant.

Future enterprise options may include a dedicated SaaS-managed database per customer or a customer-managed database. These are not MVP requirements and introduce routing, connectivity, secrets, migration, monitoring, and backup responsibilities.

## 6. Availability, Health Checks, and Scaling

- Run Rails API tasks across at least two Availability Zones where the selected environment supports it; ECS service desired count and deployment settings maintain healthy capacity.
- ALB target-group health checks use a Rails readiness endpoint; unhealthy targets are removed from traffic. ECS container health checks provide an additional process-level signal.
- Separate liveness from readiness: liveness indicates the process can respond; readiness indicates the task can serve requests and may perform bounded critical dependency checks.
- Sidekiq workers have independent operational health signals: worker heartbeat, queue latency, job duration, retry/dead-job counts, and failures.
- Use stateless Rails tasks, pagination, tenant-aware indexes, bounded import batches, async exports, and independently scalable worker capacity.
- Configure RDS Multi-AZ for production availability as selected; validate failover behavior. Multi-AZ is not a backup substitute.
## 7. Data Protection, Backup, and Recovery

- Encrypt RDS storage and S3 objects at rest using KMS-managed keys; enforce TLS in transit.
- Store database credentials and application secrets in AWS Secrets Manager or Systems Manager Parameter Store; grant access through least-privilege IAM roles.
- Configure RDS automated backups and point-in-time recovery (PITR), retention, and snapshots as required; periodically test restore into an isolated environment.
- Define S3 versioning/lifecycle/recovery controls for uploaded inputs and generated artifacts; restrict object access to authorized application flows.
- Recover application releases from Git and infrastructure-as-code; retain versioned ECR images and document redeployment/rollback.
- Make background jobs retryable/idempotent and define how interrupted jobs are safely resumed or re-enqueued.
## 8. Observability and Audit

- CloudWatch structured logs and metrics for API latency/errors, task health, CPU/memory, queue depth/latency, job duration, retries, and failures.
- Propagate request/correlation IDs into background jobs and persist actor, tenant, job ID, and outcome metadata for auditability.
- CloudTrail records AWS API activity. Distributed tracing (AWS X-Ray or OpenTelemetry-compatible tooling) can be enabled for request-to-job correlation.
- Never log passwords, secrets, raw compensation payloads, or unnecessary personal data.
## 9. Key Trade-offs and Decisions

| Decision | Rationale / trade-off |
| --- | --- |
| Rails modular monolith | Fast delivery and clear boundaries for assessment; split services only when scale/ownership justifies it. |
| React on S3 + CloudFront | Static frontend delivery avoids dedicated frontend compute; API remains separately routed. |
| ECS Fargate for Rails/Sidekiq | Managed container runtime; web and worker capacity scale independently. |
| Shared RDS schema + tenant_id | Cost-effective default; requires rigorous tenant scoping, RLS defense in depth, and security tests. |
| Sidekiq + Redis | Sufficient for MVP jobs and retry/dead handling; avoids adding SQS/DLQ complexity. |
| RLS | Defense in depth against accidental unscoped access; requires correct transaction-local tenant context and non-bypass DB role. |
| KMS + managed secrets | Centralized encryption-key and secret access controls; IAM policies and rotation must be configured. |
| ALB readiness health checks | Only healthy/ready Rails targets receive traffic; worker health is monitored separately. |
| Dedicated/customer DB | Future isolation option; higher operational and migration complexity. |

## 10. Out of Scope

- Payroll disbursement/provider integration; statutory payroll/tax calculation; FX conversion.
- Dedicated/customer-managed databases as MVP features; multi-region active-active deployment.
- SQS/DLQ, microservice decomposition, and advanced enterprise compliance automation unless later justified.
