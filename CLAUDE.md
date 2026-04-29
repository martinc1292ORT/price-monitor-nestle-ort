# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack monorepo for automated Nestlé product price monitoring across Argentine e-commerce platforms. Detects unauthorized price deviations, captures evidence (screenshots + HTML), and generates alerts for the commercial team.

**Stack:** NestJS 11 + PostgreSQL 15 + Redis 7 + BullMQ | React 19 + Vite + Tailwind CSS 4 | Playwright for scraping | Prisma 7 ORM | Docker Compose

## Commands

### Running the full stack
```bash
docker compose up --build -d        # Start all services (postgres, redis, backend, frontend)
docker compose logs -f backend      # Stream backend logs
docker compose down                 # Stop all services
```

### Backend (NestJS) — run from `backend/`
```bash
npm run start:dev                   # Dev server with watch (port 3000)
npm run build                       # Compile TypeScript to dist/
npm run lint                        # ESLint with auto-fix
npm test                            # Unit tests (Jest)
npm run test:watch                  # Jest watch mode
npm run test:cov                    # Coverage report
npm run test:e2e                    # End-to-end tests
```

### Frontend (React) — run from `frontend/`
```bash
npm run dev                         # Vite dev server (port 5173)
npm run build                       # Production build
npm run lint                        # ESLint checks
```

### Database
```bash
# Run from backend/
npx prisma migrate dev --name <migration_name>   # Create and apply migration
npx prisma db seed                               # Seed default admin user + sample data
npx prisma studio                                # Visual DB browser
npx prisma generate                              # Regenerate client after schema changes
```

### Single test file
```bash
# From backend/
npx jest src/alerts/alerts.service.spec.ts --no-coverage
npx jest --testPathPattern="rules-engine" --no-coverage
```

## Architecture

### Backend module structure (`backend/src/`)

All routes are prefixed `/api`. Three global guards wrap every request in order: `ThrottlerGuard` (100 req/60s) → `JwtAuthGuard` → `RolesGuard`. Use `@Public()` to bypass JWT, `@Roles('admin')` to restrict access.

| Module | Responsibility |
|---|---|
| `auth/` | Login, JWT access + refresh token flow, bcrypt hashing |
| `users/` | User lookup service (no controller — internal only) |
| `products/` | Product catalog CRUD, monitoring rule creation |
| `retailer-urls/` | Per-retailer URL tracking with selector persistence |
| `scraping/` | Playwright browser automation + multi-strategy price/promo extraction |
| `rules-engine/` | Evaluates price deviation rules against captured prices |
| `alerts/` | Alert generation, querying, and status updates |
| `database/` | `PrismaService` — extends PrismaClient, exported from AppModule |
| `common/` | Shared decorators (`@Public`, `@Roles`), guards, DTOs |

`PrismaService` is provided and exported by `AppModule`, so any feature module can inject it directly without re-importing `DatabaseModule`.

### Scraping pipeline

`ScrapingController` → `ScrapingService` → `PlaywrightService` (Chromium, headless) + `PriceExtractor` + `PromoExtractor`.

Price extraction uses a strategy waterfall: JSON-LD schema.org → OpenGraph meta → Microdata (`itemprop`) → CSS selectors. Promo detection checks struck prices, keyword lists, and badge elements.

BullMQ and ioredis are installed but **not yet wired up** — scraping is currently triggered synchronously via HTTP POST. Redis is available for when async job queues are implemented.

### Auth flow

- `POST /api/auth/login` → returns `accessToken` (15m) + `httpOnly` refresh cookie (7d)
- `POST /api/auth/refresh` → rotates both tokens
- `POST /api/auth/logout` → invalidates refresh token in DB
- Refresh tokens are stored in the `RefreshToken` table and compared on each refresh

### Frontend (`frontend/src/`)

React 19 SPA with React Router, Axios (with interceptors for token refresh), and Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed).

### Database schema (Prisma)

Key models: `User`, `RefreshToken`, `Product`, `RetailerUrl`, `PriceCapture`, `MonitoringRule`, `Alert`. Schema at `backend/prisma/schema.prisma`. Generated client output: `backend/src/generated/prisma/`.

## Environment setup

Copy `.env.example` to `.env` at repo root before running Docker. Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_HOST` / `REDIS_PORT` — Redis for BullMQ (future use)
- `JWT_SECRET` — minimum 64 random characters
- `SCRAPING_CONCURRENCY` — parallel Playwright instances (default: 2)
- `SMTP_*` / `ALERT_EMAIL_*` — optional; alerts log to console if unset

Default admin after seeding: `admin@precio-monitor.com` / `Admin1234!`

## Branch and commit conventions

- Branches: `master` (prod) / `develop` / `feature/pm-<ticket>-<slug>`
- Commit prefixes: `feat`, `fix`, `chore`, `docs`, `test`
