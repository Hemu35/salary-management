# Global Employee Compensation Management System

A secure full-stack HR application for managing employee records, tracking effective-dated compensation history, and viewing workforce analytics across 10,000 synthetic employees.

**Incubyte Software Craftsperson / Ruby on Rails Assessment**

---

## Status

> Implementation in progress — see milestones below.

| Milestone | Status |
|-----------|--------|
| M0 — Docs & scaffold | ✅ Done |
| M1 — Runnable foundation | 🔄 In progress |
| M2 — Secure access | ⬜ Pending |
| M3 — Employee directory | ⬜ Pending |
| M4 — Compensation history | ⬜ Pending |
| M5 — Seed & insights | ⬜ Pending |
| M6 — Quality, deploy & demo | ⬜ Pending |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Ruby on Rails 7.1 (API mode) |
| Frontend | React 18 + Vite |
| Database | PostgreSQL 16 |
| Backend tests | RSpec |
| Frontend tests | Vitest + React Testing Library |
| Auth | Session cookie (bcrypt, CSRF) |
| Dev environment | Docker Compose |

---

## Requirements

- Docker & Docker Compose
- Node.js >= 18 (for local frontend dev only)
- Git

> No local Ruby or PostgreSQL installation needed — Docker handles everything.

---

## Setup

```bash
# Clone the repository
git clone https://github.com/Hemu35/salary-management.git
cd salary-management

# Copy environment variables
cp .env.example .env

# Build and start all services
docker compose up --build
```

---

## Run

| Service | URL |
|---------|-----|
| React frontend | http://localhost:3000 |
| Rails API | http://localhost:3001 |
| API health check | http://localhost:3001/api/health |

---

## Tests

```bash
# Backend (RSpec)
docker compose exec backend bundle exec rspec --format documentation

# Frontend (Vitest)
docker compose exec frontend npm run test
```

---

## Seed Data

```bash
# Create DB, run migrations, seed 10,000 deterministic employees
docker compose exec backend bin/rails db:prepare db:seed

# To reset and reseed from scratch
docker compose exec backend bin/rails db:reset db:seed
```

---

## Demo Account

For local/demo use only:

| Field | Value |
|-------|-------|
| Email | hr@example.com |
| Password | password123 |

> Never commit real credentials. This account is seeded by `db/seeds.rb`.

---

## Architecture

See [`docs/`](./docs/) for:
- PRD, HLD, LLD
- Architecture diagram
- Test plan
- Decision log
- AI usage log

---

## Deployment

> To be documented after local MVP is verified.

---

## Known Limitations

- Payroll execution and statutory tax calculations are out of scope (MVP)
- No foreign-exchange conversion — compensation summaries are grouped by currency only
- No employee self-service portal
- No multi-level approval workflows
