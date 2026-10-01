# **Assessment README Template**

**Global Employee Compensation Management System**

*Incubyte Assessment • Version 2.5*

## Project Overview

Global Employee Compensation Management System — a multi-tenant application for HR teams to manage employee and compensation records across countries and currencies. Replace this template content with verified project details before submission.

## Features

- Authentication and role/domain-scoped authorization
- Tenant-isolated employee directory, search, filters and pagination
- Compensation records and effective-dated history
- Asynchronous CSV import/export with job status and error reporting
- Workforce insights and compensation summaries grouped by currency
- Deterministic seed for 10,000 synthetic employees
## Technology and Architecture

Document the actual implemented versions and deployment topology. Target architecture: React, Rails API modular monolith, Sidekiq/Redis, Amazon RDS for PostgreSQL, S3/CloudFront, ALB/ECS Fargate, KMS and managed secrets. Clearly label any target component not implemented.

## Local Setup

TODO: Add verified prerequisites, environment variable names (never values), database setup/migrations, seed command, frontend/backend startup commands, and worker startup command.

## Tests

TODO: Add exact test commands and the latest verified results. Include PostgreSQL integration tests for RLS; SQLite tests alone do not validate RLS.

## Health, Security and Recovery

- Document implemented liveness/readiness endpoints and deployment health-check configuration.
- Document RDS/S3 encryption, KMS, secret storage, and IAM only after verifying configuration.
- Document backup retention/PITR and restore-drill evidence; do not claim recovery readiness without a tested restore.
- Describe tenant and domain isolation tests.
## Known Limitations and Trade-offs

- Payroll execution, statutory payroll/tax calculations, and FX conversion are out of scope.
- Dedicated/customer-managed databases and SQS/DLQ are not MVP requirements.
- List any remaining implementation gaps, performance measurements, or operational controls not yet verified.
## Demo and Submission

TODO: Add deployed URL, demo video link, repository URL, test evidence, architecture diagram location, and setup/teardown notes.
