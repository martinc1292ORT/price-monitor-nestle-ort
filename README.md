<div align="right">
  <a href="#english">🇺🇸 English</a> &nbsp;|&nbsp;
  <a href="#español">🇦🇷 Español</a>
</div>

---

# Price Monitor — Nestlé

<a name="english"></a>

> Internal tool for automated price monitoring of Nestlé products across Argentine e-commerce platforms.

Detects unauthorized price deviations, undisclosed promotions, and discrepancies against the reference price. Generates automatic alerts for the commercial team, stores historical data, and exposes a consolidated dashboard for tracking and reporting.

---

## Table of Contents

- [Stack](#stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Health Check](#api-health-check)
- [Default Credentials](#default-credentials)
- [Environment Variables](#environment-variables)
- [Development (without Docker)](#development-without-docker)

---

## Stack

| Layer | Technology |
|---|---|
| Backend / API | NestJS + TypeScript |
| Authentication | @nestjs/jwt + @nestjs/passport + bcrypt |
| Scraping | Playwright |
| HTML Parsing | Cheerio |
| Scheduler | node-cron |
| Job Queue | BullMQ |
| Message Broker | Redis 7 |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Frontend | React + Vite + TypeScript |
| Styles | Tailwind CSS |
| Charts | Recharts |
| Tables | TanStack Table v8 |
| Reports | ExcelJS + csv-stringify |
| Email | Nodemailer |
| Infrastructure | Docker + Docker Compose |

---

## Prerequisites

| Tool | Version |
|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | >= 24.x |
| [Node.js](https://nodejs.org/) | >= 20.x |
| npm | >= 10.x (bundled with Node) |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/martinc1292ORT/price-monitor.git
cd price-monitor
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values (see [Environment Variables](#environment-variables)).

### 3. Start all services

```bash
docker compose up --build -d
```

This starts the following containers:

| Service | URL |
|---|---|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Backend API | `http://localhost:3000` |
| Frontend | `http://localhost:5173` |

### 4. Run database migrations

```bash
cd backend
npx prisma migrate dev --name init
```

### 5. Seed the database

```bash
npx prisma db seed
```

This creates the default admin user (see [Default Credentials](#default-credentials)).

### 6. Verify the setup

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

The frontend will be available at `http://localhost:5173`.

---

## Project Structure

```
price-monitor/
├── backend/              # NestJS API
│   ├── src/
│   ├── prisma/           # Database schema and migrations
│   ├── evidence/         # Scraping screenshots and HTML snapshots
│   └── Dockerfile
├── frontend/             # React + Vite application
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Health Check

```
GET /api/health
```

This endpoint is public and does not require authentication. Use it to verify the backend is running.

---

## Default Credentials

After running the seed, the following admin account is available:

| Field | Value |
|---|---|
| Email | `admin@precio-monitor.com` |
| Password | `Admin1234!` |

> **Important:** Change the default password before deploying to a production environment.

---

## Environment Variables

The following variables are required in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/price_monitor

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=replace_with_a_long_random_secret_minimum_64_chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Application
NODE_ENV=development
PORT=3000
SCRAPING_CONCURRENCY=2
EVIDENCE_BASE_PATH=./evidence

# Email (optional in development — alerts are logged to console if not set)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ALERT_EMAIL_FROM=
ALERT_EMAIL_TO=
```

---

## Development (without Docker)

To run services locally, ensure PostgreSQL and Redis are running, then:

**Backend:**

```bash
cd backend
cp ../.env.example .env   # adjust DATABASE_URL and REDIS_HOST to localhost
npm install
npx prisma migrate dev
npm run start:dev
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

---
---

<a name="español"></a>
<div align="right"><a href="#english">↑ Back to English</a></div>

# Price Monitor — Nestlé

> Herramienta interna para el monitoreo automatizado de precios de productos Nestlé en e-commerce argentino.

Detecta desvíos de precio no autorizados, promociones no permitidas y diferencias respecto al precio de referencia. Genera alertas automáticas para el equipo comercial, almacena el historial de capturas y expone un dashboard consolidado para seguimiento y reportes.

---

## Tabla de Contenidos

- [Stack Tecnológico](#stack-tecnológico)
- [Requisitos Previos](#requisitos-previos)
- [Instalación y Puesta en Marcha](#instalación-y-puesta-en-marcha)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Health Check](#health-check)
- [Credenciales por Defecto](#credenciales-por-defecto)
- [Variables de Entorno](#variables-de-entorno)
- [Desarrollo Local (sin Docker)](#desarrollo-local-sin-docker)

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend / API | NestJS + TypeScript |
| Autenticación | @nestjs/jwt + @nestjs/passport + bcrypt |
| Scraping | Playwright |
| Parsing HTML | Cheerio |
| Scheduler | node-cron |
| Cola de Jobs | BullMQ |
| Message Broker | Redis 7 |
| Base de Datos | PostgreSQL 15 |
| ORM | Prisma |
| Frontend | React + Vite + TypeScript |
| Estilos | Tailwind CSS |
| Gráficos | Recharts |
| Tablas | TanStack Table v8 |
| Reportes | ExcelJS + csv-stringify |
| Email | Nodemailer |
| Infraestructura | Docker + Docker Compose |

---

## Requisitos Previos

| Herramienta | Versión |
|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | >= 24.x |
| [Node.js](https://nodejs.org/) | >= 20.x |
| npm | >= 10.x (incluido con Node) |

---

## Instalación y Puesta en Marcha

### 1. Clonar el repositorio

```bash
git clone https://github.com/martinc1292ORT/price-monitor.git
cd price-monitor
```

### 2. Configurar las variables de entorno

```bash
cp .env.example .env
```

Completar los valores requeridos en `.env` (ver [Variables de Entorno](#variables-de-entorno)).

### 3. Levantar los servicios

```bash
docker compose up --build -d
```

Esto inicia los siguientes contenedores:

| Servicio | URL |
|---|---|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Backend API | `http://localhost:3000` |
| Frontend | `http://localhost:5173` |

### 4. Ejecutar las migraciones de base de datos

```bash
cd backend
npx prisma migrate dev --name init
```

### 5. Cargar datos iniciales (seed)

```bash
npx prisma db seed
```

Esto crea el usuario administrador por defecto (ver [Credenciales por Defecto](#credenciales-por-defecto)).

### 6. Verificar que todo funciona

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

El frontend estará disponible en `http://localhost:5173`.

---

## Estructura del Proyecto

```
price-monitor/
├── backend/              # API en NestJS
│   ├── src/
│   ├── prisma/           # Schema y migraciones de base de datos
│   ├── evidence/         # Screenshots y HTML capturados por el scraper
│   └── Dockerfile
├── frontend/             # Aplicación React + Vite
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Health Check

```
GET /api/health
```

Este endpoint es público y no requiere autenticación. Se puede usar para verificar que el backend está operativo.

---

## Credenciales por Defecto

Después de ejecutar el seed, la siguiente cuenta de administrador estará disponible:

| Campo | Valor |
|---|---|
| Email | `admin@precio-monitor.com` |
| Contraseña | `Admin1234!` |

> **Importante:** Cambiar la contraseña por defecto antes de desplegar en un entorno productivo.

---

## Variables de Entorno

Las siguientes variables son requeridas en el archivo `.env`:

```env
# Base de datos
DATABASE_URL=postgresql://user:password@postgres:5432/price_monitor

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=reemplazar_con_un_secreto_largo_y_aleatorio_minimo_64_chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Aplicación
NODE_ENV=development
PORT=3000
SCRAPING_CONCURRENCY=2
EVIDENCE_BASE_PATH=./evidence

# Email (opcional en desarrollo — las alertas se loguean en consola si no se configura)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ALERT_EMAIL_FROM=
ALERT_EMAIL_TO=
```

---

## Desarrollo Local (sin Docker)

Para correr los servicios localmente es necesario tener PostgreSQL y Redis corriendo. Luego:

**Backend:**

```bash
cd backend
cp ../.env.example .env   # ajustar DATABASE_URL y REDIS_HOST a localhost
npm install
npx prisma migrate dev
npm run start:dev
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```
