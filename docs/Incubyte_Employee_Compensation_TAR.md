# **Technical Architecture Review (TAR)**

**Global Employee Compensation Management System**

*Assessment architecture baseline • Design document, not deployment evidence*

## 1. Purpose and Scope

This document explains the proposed architecture for a multi-tenant SaaS application that enables organizations to manage employee and compensation records across countries and currencies. It includes the architecture diagram, major components, request and data flows, security boundaries, operational considerations, and future options.

This is a target design for the assessment. Planned controls must be implemented, configured, and verified before being described as deployed.

## 2. Architecture Design

The diagram below is the visual architecture baseline.

## 3. Architecture Overview

Multiple organizations use the same application instance while tenant-level controls isolate their records. Within each tenant, domain-scoped authorization can further restrict HR users to permitted employee groups. The platform supports multi-country and multi-currency compensation records; this does not imply automatic foreign-exchange conversion or statutory payroll calculation.

## 4. Layer-by-Layer Explanation

### 4.1 Client Layer

HR users from multiple organizations access the responsive React application through a browser. Each user is authenticated and associated with a tenant and authorized scope.

### 4.2 Edge & Security Layer

Route 53 provides DNS. CloudFront delivers React static assets from S3. AWS WAF protects the web/API entry point. ACM provides TLS certificates. API requests route through the Application Load Balancer (ALB) to healthy Rails API tasks. ACM is supporting certificate infrastructure, not a traffic-routing hop.

### 4.3 Application Layer

React presents employee, compensation, salary-history, search, analytics, and CSV workflows. The Ruby on Rails API implements business logic, authentication/authorization, tenant resolution, domain access checks, CRUD, reporting, and background-job creation. Rails runs on ECS Fargate across Availability Zones. Sidekiq runs as a separate ECS service for long-running CSV imports/exports and reports. Redis backs Sidekiq queues; cache/session workloads may be separated.

### 4.4 Data Layer

Amazon RDS for PostgreSQL is the default shared relational database using a shared schema and tenant_id logical separation. PostgreSQL Row-Level Security (RLS) is planned as defense in depth alongside application authorization. Tenant context must be safely established for each request/job, and the application DB role must not bypass RLS. S3 stores uploaded/generated files with tenant-scoped access. RDS Multi-AZ supports availability; automated backups, point-in-time recovery, snapshots, and restore tests support recovery.

### 4.5 Security & Configuration

Use TLS in transit, KMS-managed encryption, AWS Secrets Manager or Systems Manager Parameter Store for secrets, and least-privilege IAM roles. Do not log credentials or sensitive salary values. Tenant isolation and domain-scoped authorization are distinct controls.

### 4.6 Deployment & Infrastructure

ECR stores versioned Rails/Sidekiq images; ECS Fargate runs services. Git stores application and infrastructure-as-code definitions (such as CDK/CloudFormation) for repeatable deployment and rollback. CloudWatch provides logs/metrics, CloudTrail records AWS API activity, X-Ray or equivalent can provide tracing, SNS can deliver alerts, and Systems Manager supports operations.

## 5. Request and Data Flows

### 5.1 Standard API Request

The browser loads React static assets from S3 through CloudFront.

The browser sends an API request through the protected edge path to the ALB.

The ALB routes the request to a healthy Rails API task.

Rails authenticates the user, resolves tenant context, and enforces tenant and domain permissions.

Rails reads or updates tenant-scoped records in RDS and returns a response.

### 5.2 CSV Import/Export Background Flow

Rails validates the request and stores or references the input file in S3.

Rails enqueues a tenant-scoped job through Redis/Sidekiq and returns a job identifier/status.

A Sidekiq worker processes bounded batches with validation, idempotency, retries, and row-level error reporting.

Import results are persisted in RDS; generated exports are stored in S3 with controlled tenant-scoped access.

The authorized user checks job status and retrieves the result.

## 6. Tenant Isolation and Enterprise Database Options

Default MVP: shared RDS for PostgreSQL database/schema with tenant_id isolation and planned RLS defense in depth. Domain-scoped access applies within an organization and does not replace tenant isolation. Future options include a dedicated SaaS-managed RDS database per customer or a customer-managed database. These options add connectivity, secret management, migrations, monitoring, backup ownership, and operational requirements.

## 7. Backup, Recovery, and Availability

- Source recovery: remote Git repository with application and infrastructure definitions.
- Container recovery: retain versioned ECR images and document redeployment/rollback to a known-good release.
- Database recovery: configure RDS automated backups and point-in-time recovery, take snapshots as needed, and periodically test restoration.
- File recovery: define S3 versioning, lifecycle, and recovery policies appropriate to uploaded/generated files.
- Availability: run Rails tasks across multiple Availability Zones and configure ALB/ECS health checks; configure RDS Multi-AZ if selected.
- Background jobs: make jobs retryable/idempotent and document safe handling or re-enqueueing of interrupted work.
## 8. Observability and Operational Safeguards

Use structured logs and request/correlation IDs. Propagate correlation IDs into background jobs and record duration, completion/failure, retries, and import row errors. Distributed tracing is a useful production enhancement. Keep sensitive compensation data and secrets out of logs.

## 9. Scope Boundaries and Assumptions

- Multi-country and multi-currency records are in scope; automatic FX conversion and statutory payroll calculations are not implied.
- Payroll execution/disbursement and payroll-provider integration are outside the current assessment scope.
- Dedicated/customer-managed databases, multi-region deployment, and advanced compliance configurations are future options unless separately approved.
- RLS policies, backup retention, restore tests, encryption settings, and availability configurations must be validated during implementation; this document is not proof of deployment.
## 10. Architecture Decisions Summary

| Decision | Baseline |
| --- | --- |
| Frontend | React static assets on S3 delivered through CloudFront |
| Backend | Ruby on Rails API on ECS Fargate behind ALB |
| Background jobs | Separate Sidekiq ECS service with Redis queue |
| Database | Amazon RDS for PostgreSQL; shared schema and tenant_id isolation |
| Tenant protection | Application authorization plus planned PostgreSQL RLS defense in depth |
| File storage | Amazon S3 with tenant-scoped access |
| Security | TLS, KMS, managed secrets, least-privilege IAM |
| Recovery | Git/IaC, versioned ECR images, RDS backups/PITR/snapshots, S3 recovery policy |
| Future options | Dedicated SaaS-managed/customer-managed database; multi-region/compliance extensions |
