# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal tool for automated price monitoring of Nestlé products across Argentine e-commerce platforms. Detects unauthorized price deviations, undisclosed promotions, and discrepancies against reference prices, generating alerts for the commercial team.

## Development Commands

All commands run from the respective subdirectory (`backend/` or `frontend/`).

### Backend (`cd backend`)

```bash
npm run start:dev          # Watch mode with hot reload
npm run build              # Compile TypeScript to dist/
npm run lint               # ESLint with auto-fix
npm run format             # Prettier formatting

npm run test               # Unit tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # E2E tests
npm run test -- --testPathPattern=scraping  # Single test file/pattern
```

### Frontend (`cd frontend`)

```bash
npm run dev                # Vite dev server on port 5173
npm run build              # Production build
npm run lint               # ESLint
```

### Docker (root directory)

```bash
docker compose up --build -d          # Start all services
docker compose down                   # Stop all services
```

### Database (from `backend/`)

```bash
npx prisma migrate dev                # Apply migrations
npx prisma db seed                    # Seed default admin user
npx prisma studio                     # GUI for database inspection
npx prisma generate                   # Regenerate Prisma client after schema changes
```

## Architecture

Monorepo with two independent apps sharing a Docker Compose network.

### Backend — NestJS 11 + TypeScript + PostgreSQL

Feature modules registered in [backend/src/app.module.ts](backend/src/app.module.ts):

| Module | Path | Purpose |
|--------|------|---------|
| Auth | `src/auth/` | JWT login/refresh/logout, Passport strategy, bcrypt |
| Users | `src/users/` | CRUD, password updates, soft-delete via `isActive` |
| Products | `src/products/` | CRUD with target price + tolerance |
| RetailerUrls | `src/retailer-urls/` | Retailer URLs, learned selectors with confidence scores |
| Scraping | `src/scraping/` | Playwright browser automation + price/promo extraction |
| Database | `src/database/` | Prisma singleton service (global) |

**Global guards** (applied via `APP_GUARD` in `app.module.ts` — no per-controller decoration needed):
- `JwtAuthGuard` — validates JWT on all routes; routes opt-out with `@Public()`
- `RolesGuard` — checks `user.role` (admin/viewer); uses `@Roles()` decorator
- `ThrottlerGuard` — 100 requests per 60 seconds

### Scraping Pipeline

[backend/src/scraping/scraping.service.ts](backend/src/scraping/scraping.service.ts) orchestrates:

1. **Playwright** (`playwright.service.ts`) — launches browser, loads page
2. **PriceExtractor** (`price.extractor.ts`) — 4-strategy fallback chain:
   - CSS selector (learned selectors stored in `RetailerUrl.learnedSelectors`)
   - XPath
   - Microdata / schema.org structured data
   - Raw HTML parsing (Cheerio)
3. **PromoExtractor** (`promo.extractor.ts`) — detects promotional text and discounts
4. **Evidence capture** — screenshots + HTML snapshots saved to `backend/evidence/<retailer-url-id>/<date>/`

Price parsing (EU/US format detection) lives in `price-parser.util.ts`.

### Queue

BullMQ + Redis 7 handles background scraping jobs. Job configuration and scheduling use `node-cron` and `MonitoringConfig` records in the database.

### Frontend — React 19 + Vite + Tailwind CSS

```
AuthContext (context/) → axiosInstance (services/axiosInstance.ts, JWT interceptors)
  → authService / other services
  → pages: LoginPage, DashboardPage, AdminPage
```

[frontend/src/services/axiosInstance.ts](frontend/src/services/axiosInstance.ts) attaches the JWT access token to every request and handles 401 refresh-token rotation.

### Database Schema

Defined in [backend/prisma/schema.prisma](backend/prisma/schema.prisma). Key models and relationships:

```
User           → RefreshToken (cascade delete)
Product        → RetailerUrl → PriceCapture
Product        → MonitoringRule
RetailerUrl    → Alert
PriceCapture   (price, struck-through price, promo text, screenshot path)
Alert          (deviation/promo/error alerts with status workflow)
JobLog         (audit trail per scraping run)
MonitoringConfig (scheduling settings)
```

## Infrastructure

Docker Compose services (defined in [docker-compose.yml](docker-compose.yml)):

| Service | Port |
|---------|------|
| PostgreSQL 15 | 5432 |
| Redis 7 | 6379 |
| Backend (NestJS) | 3000 |
| Frontend (Vite) | 5173 |

Health check: `GET http://localhost:3000/api/health`

Default seed admin (created by `npx prisma db seed`):
- Email: `admin@precio-monitor.com`
- Password: `Admin1234!`

Environment variables are documented in `.env` (Spanish comments). Key ones: `DATABASE_URL`, `REDIS_HOST/PORT`, `JWT_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `SCRAPING_CONCURRENCY` (default 2), `EVIDENCE_BASE_PATH`.
