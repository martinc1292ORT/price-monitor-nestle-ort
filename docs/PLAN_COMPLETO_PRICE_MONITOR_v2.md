# Plan de Desarrollo Completo — Sistema de Monitoreo de Precios en E-Commerce

> **Instrucción para Claude Code:**
> Este documento es el plan maestro del proyecto. Leelo completo antes de empezar cualquier tarea.
> Avanzar siempre sprint por sprint. No pasar al siguiente hasta que el actual esté completo y validado.
> Al inicio de cada sesión, indicar en qué etapa, sprint y tarea estás parado.

---

## Índice

- [Stack Tecnológico](#stack)
- [Decisiones de Arquitectura](#arquitectura)
- [Schema de Base de Datos](#schema)
- [Módulos NestJS](#modulos)
- [ETAPA 1 — MVP](#etapa1)
  - Sprint 0: Fundación
  - Sprint 1: Autenticación y Usuarios
  - Sprint 2: Gestión de Productos y URLs
  - Sprint 3: Motor de Scraping
  - Sprint 4: Jobs y Scheduler
  - Sprint 5: Motor de Reglas y Alertas
  - Sprint 6: Frontend MVP
  - Sprint 7: Reportes, Incidencias y Cierre
- [ETAPA 2 — Versión Completa](#etapa2)
  - Fase A: Observabilidad y Hardening
  - Fase B: Stagehand — Scraping Inteligente
  - Fase C: Almacenamiento y Reportes Avanzados
  - Fase D: Escala y Multi-Producto
- [Guía de Sesiones](#sesiones)
- [Notas sobre Retailers Argentinos](#retailers)

---

## Stack Tecnológico {#stack}

### MVP

| Capa | Tecnología |
|---|---|
| Backend / API | NestJS + TypeScript |
| Autenticación | @nestjs/jwt + @nestjs/passport + bcrypt |
| Scraping | Playwright |
| Parsing auxiliar | Cheerio |
| Scheduler | node-cron |
| Colas / Jobs | BullMQ |
| Message Broker | Redis |
| Base de datos | PostgreSQL |
| ORM | Prisma |
| Frontend | React + Vite + TypeScript |
| Estilos | Tailwind CSS |
| Gráficos | Recharts |
| Tablas | TanStack Table v8 |
| Reportes | ExcelJS + csv-stringify |
| Email | Nodemailer |
| Infraestructura | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Seguridad base | Helmet, class-validator, .env, rate limiting |

### Versión Completa (post-MVP, se agrega sobre el MVP)

| Capa | Tecnología |
|---|---|
| Scraping inteligente | Stagehand (sobre Playwright) |
| Reportes PDF | PDFKit |
| Almacenamiento evidencias | MinIO (S3-compatible) |
| Notificaciones Teams | Webhooks + Adaptive Cards |
| Email corporativo | Microsoft Graph API (si lo requiere Nestlé) |
| Logging estructurado | Pino |
| Panel de colas | Bull Board |
| Scraping a escala | Cloudflare Browser Rendering (si el volumen lo justifica) |
| Distribución | Docker Hub |
| Seguridad completa | OWASP completo, audit de dependencias |

---

## Decisiones de Arquitectura {#arquitectura}

### Estructura de carpetas
```
price-monitor/
├── backend/          # NestJS app
├── frontend/         # React + Vite app
├── docker-compose.yml
├── .env.example
└── README.md
```

### Autenticación — Diseño

Se usa **JWT stateless** con dos tokens:
- `access_token`: vida corta (15 minutos), para cada request autenticado
- `refresh_token`: vida larga (7 días), para renovar el access token sin re-login

Flujo:
1. `POST /auth/login` → devuelve `{ access_token, refresh_token }`
2. El frontend guarda los tokens en memoria (`access_token`) y en `httpOnly cookie` (`refresh_token`)
3. Cada request al backend incluye `Authorization: Bearer <access_token>`
4. Cuando el access token expira, el frontend llama a `POST /auth/refresh` con la cookie

Roles:
- `admin`: puede crear/editar productos, URLs, reglas y gestionar alertas
- `viewer`: solo puede ver dashboard, alertas y exportar reportes

El `JwtAuthGuard` se aplica globalmente en `AppModule`. Las rutas públicas se marcan con el decorador `@Public()`.

### Evidencia de scraping
- Screenshots: `backend/evidence/screenshots/YYYY-MM-DD/`
- HTML: `backend/evidence/html/YYYY-MM-DD/`
- En Docker: montar esa carpeta como volumen nombrado
- En DB: solo el path relativo, nunca el binario
- En la versión completa (Fase C): migrar a MinIO sin cambiar la interfaz del `StorageService`

### Motor de Reglas
- Las reglas se guardan en DB (tabla `MonitoringRule`), no en código
- El `RulesEngineService` recibe una captura y las reglas, y devuelve las alertas a crear
- No tiene acceso directo a la DB: puro input/output, fácil de testear

---

## Schema de Base de Datos (Prisma) {#schema}

Crear exactamente este schema en `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── USUARIOS ───────────────────────────────────────────────────────────────

model User {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  password     String    // bcrypt hash
  name         String
  role         String    @default("viewer") // "admin" | "viewer"
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  refreshTokens RefreshToken[]
  alerts       Alert[]
}

model RefreshToken {
  id        Int      @id @default(autoincrement())
  token     String   @unique
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

// ─── PRODUCTOS ───────────────────────────────────────────────────────────────

model Product {
  id           Int              @id @default(autoincrement())
  name         String
  sku          String           @unique
  brand        String?
  category     String?
  targetPrice  Decimal          @db.Decimal(10, 2)
  tolerance    Decimal?         @db.Decimal(5, 2)  // porcentaje, ej: 2.5 = 2.5%
  status       String           @default("active") // "active" | "inactive"
  validFrom    DateTime?
  validTo      DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  retailerUrls RetailerUrl[]
  rules        MonitoringRule[]
  alerts       Alert[]
}

// ─── RETAILERS / URLS ────────────────────────────────────────────────────────

model RetailerUrl {
  id                  Int            @id @default(autoincrement())
  productId           Int
  product             Product        @relation(fields: [productId], references: [id])
  retailerName        String
  url                 String
  internalCode        String?
  country             String?
  detectedName        String?
  status              String         @default("active") // "active" | "inactive" | "error" | "not_found"
  notes               String?
  // Campos para Fase B (Stagehand) — se agregan vacíos desde el inicio
  learnedSelector     String?
  selectorConfidence  Float?
  lastSelectorUpdate  DateTime?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  captures            PriceCapture[]
  alerts              Alert[]
}

// ─── CAPTURAS ────────────────────────────────────────────────────────────────

model PriceCapture {
  id              Int         @id @default(autoincrement())
  retailerUrlId   Int
  retailerUrl     RetailerUrl @relation(fields: [retailerUrlId], references: [id])
  capturedAt      DateTime    @default(now())
  currentPrice    Decimal?    @db.Decimal(10, 2)
  struckPrice     Decimal?    @db.Decimal(10, 2)
  promoText       String?
  promoType       String?     // "discount" | "2x1" | "installments" | "payment_method" | "other"
  discountPct     Decimal?    @db.Decimal(5, 2)
  stock           String?     // "available" | "out_of_stock" | "unknown"
  detectedName    String?
  screenshotPath  String?
  htmlPath        String?
  checkResult     String      @default("ok") // "ok" | "deviation" | "promo" | "error" | "not_found"
  rawData         Json?
}

// ─── REGLAS DE NEGOCIO ───────────────────────────────────────────────────────

model MonitoringRule {
  id              Int      @id @default(autoincrement())
  productId       Int
  product         Product  @relation(fields: [productId], references: [id])
  ruleType        String   // "exact_price" | "min_price" | "max_price" | "range" | "no_promo"
  minPrice        Decimal? @db.Decimal(10, 2)
  maxPrice        Decimal? @db.Decimal(10, 2)
  allowPromos     Boolean  @default(false)
  maxDiscountPct  Decimal? @db.Decimal(5, 2)
  severity        String   @default("warning") // "info" | "warning" | "critical"
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
}

// ─── ALERTAS ─────────────────────────────────────────────────────────────────

model Alert {
  id                 Int          @id @default(autoincrement())
  productId          Int
  product            Product      @relation(fields: [productId], references: [id])
  retailerUrlId      Int
  retailerUrl        RetailerUrl  @relation(fields: [retailerUrlId], references: [id])
  type               String       // "price_below" | "price_above" | "promo_detected" | "struck_price" | "not_found" | "scraping_error"
  severity           String       // "info" | "warning" | "critical"
  status             String       @default("open") // "open" | "in_review" | "resolved" | "dismissed"
  detectedValue      Decimal?     @db.Decimal(10, 2)
  expectedValue      Decimal?     @db.Decimal(10, 2)
  description        String?
  comment            String?
  resolutionComment  String?
  resolvedAt         DateTime?
  assignedUserId     Int?
  assignedUser       User?        @relation(fields: [assignedUserId], references: [id])
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
}

// ─── CONFIG Y LOGS ───────────────────────────────────────────────────────────

model MonitoringConfig {
  id         Int      @id @default(autoincrement())
  frequency  String   @default("6h") // "1h" | "3h" | "6h" | "12h" | "24h" | cron expression
  isRunning  Boolean  @default(true)
  updatedAt  DateTime @updatedAt
}

model JobLog {
  id            Int      @id @default(autoincrement())
  jobId         String
  jobName       String
  status        String   // "started" | "completed" | "failed"
  retailerUrlId Int?
  error         String?
  duration      Int?     // milliseconds
  createdAt     DateTime @default(now())
}
```

---

## Módulos NestJS {#modulos}

```
backend/src/
├── app.module.ts
├── main.ts
├── common/
│   ├── decorators/
│   │   └── public.decorator.ts       @Public() para rutas sin auth
│   ├── guards/
│   │   ├── jwt-auth.guard.ts         Guard global
│   │   └── roles.guard.ts            Guard por rol
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── interceptors/
│       └── logging.interceptor.ts
├── config/
│   └── configuration.ts
├── database/
│   └── prisma.service.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts            /auth/login, /auth/refresh, /auth/logout
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   └── dto/
│       └── login.dto.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts           /users (solo admin)
│   ├── users.service.ts
│   └── dto/
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts
│   ├── products.service.ts
│   └── dto/
├── retailer-urls/
│   ├── retailer-urls.module.ts
│   ├── retailer-urls.controller.ts
│   ├── retailer-urls.service.ts
│   └── dto/
├── scraping/
│   ├── scraping.module.ts
│   ├── scraping.service.ts
│   ├── playwright.service.ts
│   └── extractors/
│       ├── price.extractor.ts
│       └── promo.extractor.ts
├── jobs/
│   ├── jobs.module.ts
│   ├── jobs.service.ts
│   ├── scraping.processor.ts
│   └── queues.config.ts
├── rules-engine/
│   ├── rules-engine.module.ts
│   └── rules-engine.service.ts
├── alerts/
│   ├── alerts.module.ts
│   ├── alerts.controller.ts
│   └── alerts.service.ts
├── notifications/
│   ├── notifications.module.ts
│   └── email.service.ts
├── captures/
│   ├── captures.module.ts
│   └── captures.controller.ts
├── reports/
│   ├── reports.module.ts
│   ├── reports.controller.ts
│   └── reports.service.ts
└── dashboard/
    ├── dashboard.module.ts
    └── dashboard.controller.ts
```

---

# ETAPA 1 — MVP {#etapa1}

---

## Sprint 0 — Fundación del Proyecto

**Meta:** El proyecto levanta localmente con Docker. El schema de DB existe. El servidor responde.

### Variables de entorno (`.env`)
```
# Base de datos
DATABASE_URL=postgresql://user:password@postgres:5432/price_monitor

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=cambiar_por_un_secreto_largo_y_aleatorio_minimo_64_chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# App
NODE_ENV=development
PORT=3000
SCRAPING_CONCURRENCY=2
EVIDENCE_BASE_PATH=./evidence

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ALERT_EMAIL_FROM=
ALERT_EMAIL_TO=
```

### Tareas

**0.1 — Scaffolding**
```bash
mkdir price-monitor && cd price-monitor
npm i -g @nestjs/cli
nest new backend --package-manager npm
npm create vite@latest frontend -- --template react-ts
mkdir -p backend/evidence/screenshots backend/evidence/html
```

**0.2 — Docker Compose**

Servicios en `docker-compose.yml`:
- `postgres`: imagen `postgres:15`, puerto 5432, volumen persistente `postgres_data`
- `redis`: imagen `redis:7-alpine`, puerto 6379
- `backend`: build desde `./backend`, puerto 3000, volumen `./backend/evidence:/app/evidence`
- `frontend`: build desde `./frontend`, puerto 5173

**0.3 — Dependencias del backend**
```bash
cd backend

# Core
npm install @nestjs/config @nestjs/jwt @nestjs/passport
npm install passport passport-jwt passport-local
npm install @types/passport-jwt @types/passport-local --save-dev

# BullMQ
npm install @nestjs/bull bull bullmq ioredis

# Prisma
npm install @prisma/client prisma

# Scraping
npm install playwright cheerio
npx playwright install chromium

# Notificaciones y reportes
npm install nodemailer exceljs csv-stringify

# Seguridad
npm install helmet class-validator class-transformer bcrypt @nestjs/throttler
npm install @types/bcrypt --save-dev

# Jobs
npm install node-cron
npm install @types/node-cron --save-dev

npx prisma init
```

**0.4 — Prisma schema y migración**
```bash
# Copiar el schema completo definido arriba
npx prisma migrate dev --name init
npx prisma generate
```

**0.5 — PrismaService**
```typescript
// backend/src/database/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

**0.6 — Configuración global del backend**

En `main.ts`:
- `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`
- `app.use(helmet())`
- `app.enableCors({ origin: 'http://localhost:5173', credentials: true })`
- Prefijo global: `app.setGlobalPrefix('api')`

**0.7 — Health check**

`GET /api/health` → `{ status: 'ok', timestamp: Date }` — marcar con `@Public()`

### Definición de Done del Sprint 0
- [ ] `docker-compose up` levanta todos los servicios sin errores
- [ ] `GET http://localhost:3000/api/health` responde 200
- [ ] `npx prisma studio` muestra todas las tablas
- [ ] Frontend en `localhost:5173` muestra la página de Vite por defecto

---

## Sprint 1 — Autenticación y Usuarios

**Meta:** El sistema tiene login con JWT, roles, y gestión de usuarios. Todos los endpoints (excepto `/health` y `/auth/login`) requieren token válido.

### Tareas

**1.1 — UsersService**

Crear `users/users.service.ts`:
- `findByEmail(email)` → usado por el flujo de login
- `findById(id)` → usado por la estrategia JWT
- `create(dto)` → hashear password con `bcrypt.hash(password, 10)` antes de guardar
- `findAll()` → solo para admin
- `updateStatus(id, isActive)` → activar/desactivar usuario
- `changePassword(id, oldPassword, newPassword)` → verificar old password antes de cambiar

**1.2 — AuthService**

Crear `auth/auth.service.ts`:

Método `login(email, password)`:
1. Buscar usuario por email
2. Comparar password con `bcrypt.compare()`
3. Si es válido: generar `access_token` (JWT, exp 15min) y `refresh_token` (JWT, exp 7d)
4. Persistir el `refresh_token` en tabla `RefreshToken` (con fecha de expiración)
5. Actualizar `lastLoginAt` del usuario
6. Devolver `{ access_token, refresh_token, user: { id, name, email, role } }`

Método `refresh(refreshToken)`:
1. Verificar que el token existe en DB y no expiró
2. Verificar firma JWT
3. Generar nuevo `access_token`
4. Rotar el `refresh_token` (invalidar el viejo, crear uno nuevo)
5. Devolver `{ access_token, refresh_token }`

Método `logout(userId, refreshToken)`:
1. Eliminar el `refresh_token` de la DB

**1.3 — Estrategias Passport**

`strategies/local.strategy.ts`:
- Valida email + password en el endpoint de login
- Llama a `AuthService.validateUser(email, password)`

`strategies/jwt.strategy.ts`:
- Extrae el Bearer token del header `Authorization`
- Verifica firma con `JWT_SECRET`
- Adjunta `{ userId, email, role }` al request como `req.user`

**1.4 — Guards globales**

`guards/jwt-auth.guard.ts`:
- Extiende `AuthGuard('jwt')`
- Antes de verificar: chequear si la ruta tiene decorador `@Public()`; si lo tiene, dejar pasar

`guards/roles.guard.ts`:
- Leer el metadata del decorador `@Roles('admin')`
- Comparar con `req.user.role`
- Si no coincide, devolver 403

Registrar `JwtAuthGuard` como guard global en `AppModule`:
```typescript
{ provide: APP_GUARD, useClass: JwtAuthGuard },
{ provide: APP_GUARD, useClass: RolesGuard },
```

**1.5 — Decoradores**

```typescript
// common/decorators/public.decorator.ts
export const Public = () => SetMetadata('isPublic', true);

// common/decorators/roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

**1.6 — AuthController**

```
POST /api/auth/login       @Public()  → { access_token, refresh_token, user }
POST /api/auth/refresh     @Public()  → { access_token, refresh_token }
POST /api/auth/logout                 → 200 OK
GET  /api/auth/me                     → datos del usuario actual
```

**1.7 — UsersController** `@Roles('admin')`

```
GET    /api/users           Listar todos los usuarios
POST   /api/users           Crear usuario
PATCH  /api/users/:id       Activar/desactivar, cambiar rol
```

**1.8 — Rate limiting en auth**

Aplicar `@Throttle({ default: { limit: 5, ttl: 60000 } })` en `/api/auth/login` para limitar intentos de login a 5 por minuto por IP.

**1.9 — Seed de usuario admin inicial**

Crear `backend/prisma/seed.ts`:
```typescript
// Crear usuario admin por defecto si no existe
await prisma.user.upsert({
  where: { email: 'admin@precio-monitor.com' },
  update: {},
  create: {
    email: 'admin@precio-monitor.com',
    password: await bcrypt.hash('Admin1234!', 10),
    name: 'Administrador',
    role: 'admin',
  },
});
```

Ejecutar con: `npx prisma db seed`

### Definición de Done del Sprint 1
- [ ] `POST /api/auth/login` con credenciales válidas devuelve JWT
- [ ] `POST /api/auth/login` con credenciales inválidas devuelve 401
- [ ] Un endpoint protegido sin token devuelve 401
- [ ] Un endpoint `@Roles('admin')` con token de `viewer` devuelve 403
- [ ] `POST /api/auth/refresh` genera nuevo access token
- [ ] `POST /api/auth/logout` invalida el refresh token en DB
- [ ] Más de 5 intentos de login fallidos en 1 minuto devuelven 429
- [ ] El seed crea el usuario admin inicial

---

## Sprint 2 — Gestión de Productos y URLs

**Meta:** Un admin puede crear y administrar productos, URLs de retailers y reglas de monitoreo.

### Tareas

**2.1 — CRUD Productos** `@Roles('admin')` para POST/PATCH/DELETE, autenticado para GET

```
POST   /api/products
GET    /api/products                  ?page&limit&status
GET    /api/products/:id
PATCH  /api/products/:id
DELETE /api/products/:id              soft delete: status = 'inactive'
```

DTOs con `class-validator`:
- `CreateProductDto`: name (req), sku (req), brand, category, targetPrice (req, >0), tolerance (0-100), validFrom, validTo
- `UpdateProductDto`: todos opcionales (PartialType)

Validar que el `sku` sea único antes de crear.

**2.2 — CRUD RetailerUrls** `@Roles('admin')` para mutaciones

```
POST   /api/retailer-urls
GET    /api/retailer-urls             ?productId&status&page&limit
GET    /api/retailer-urls/:id
PATCH  /api/retailer-urls/:id
DELETE /api/retailer-urls/:id         soft delete
```

Validar que `url` sea URL válida (`@IsUrl()`) y que `productId` exista.

**2.3 — CRUD Reglas de Monitoreo** `@Roles('admin')`

```
POST   /api/products/:id/rules
GET    /api/products/:id/rules
PATCH  /api/rules/:id
DELETE /api/rules/:id
```

Al crear un producto (en `ProductsService.create()`), crear automáticamente una regla por defecto: tipo `no_promo`, severidad `critical`, activa.

**2.4 — Respuesta paginada estándar**

Todos los GET de listas devuelven:
```typescript
{
  data: T[],
  total: number,
  page: number,
  limit: number,
  totalPages: number
}
```

Crear un helper `paginate(data, total, page, limit)` en `common/`.

### Definición de Done del Sprint 2
- [ ] Un viewer puede listar productos y URLs (GET)
- [ ] Solo un admin puede crear, editar y desactivar
- [ ] Se puede crear un producto con SKU y precio objetivo
- [ ] Se pueden agregar múltiples URLs a un producto
- [ ] Al crear un producto se crea automáticamente la regla `no_promo`
- [ ] Todos los inputs están validados

---

## Sprint 3 — Motor de Scraping

**Meta:** Dado una URL, el sistema captura precio, detecta promociones, guarda evidencia y persiste la captura.

### Tareas

**3.1 — PlaywrightService**

Crear `scraping/playwright.service.ts`:
- Inicializar browser headless en `onModuleInit()`
- Cerrar browser en `onModuleDestroy()`
- Método `getPage(url: string)`: abre una nueva page, navega, espera `networkidle`, la devuelve
- Timeout de navegación: 30 segundos
- En caso de error de navegación, devolver `null` (no lanzar excepción)
- Configurar User-Agent realista para reducir bloqueos

**3.2 — PriceExtractor**

Crear `scraping/extractors/price.extractor.ts`:

Estrategia en orden de prioridad:
1. **JSON-LD** (`<script type="application/ld+json">` con `@type: Product`) → `offers.price`
2. **Meta tags Open Graph** → `og:price:amount`
3. **Selectores CSS conocidos** → `.price`, `[data-price]`, `.precio`, `#price`, `.product-price`, `[itemprop="price"]`
4. Si todo falla → devolver `null`

Loguear qué estrategia fue usada. No lanzar excepciones: capturar internamente y devolver `null`.

**3.3 — PromoDetector**

Crear `scraping/extractors/promo.extractor.ts`:

Detectar:
- Precio tachado: `text-decoration: line-through`, clases `.price-before`, `.original-price`, `.tachado`, `.precio-anterior`
- Texto promo: buscar en el DOM las keywords `oferta`, `descuento`, `promo`, `cyber`, `% off`, `2x1`, `cuotas sin interés`, `ahorrá`, `precio especial`
- Badges: `.badge`, `.tag`, `.label` con esos textos
- Calcular `discountPct` si se encontraron ambos precios

Devolver:
```typescript
interface PromoResult {
  hasPromo: boolean;
  struckPrice: number | null;
  promoText: string | null;
  promoType: 'discount' | '2x1' | 'installments' | 'payment_method' | 'other' | null;
  discountPct: number | null;
}
```

**3.4 — Evidencia**

En `ScrapingService`:
- Screenshot: `page.screenshot({ path, fullPage: true })`
- HTML: `await page.content()` → escribir a disco con `fs.writeFile()`
- Path screenshots: `{EVIDENCE_BASE_PATH}/screenshots/YYYY-MM-DD/{retailerUrlId}_{timestamp}.png`
- Path HTML: `{EVIDENCE_BASE_PATH}/html/YYYY-MM-DD/{retailerUrlId}_{timestamp}.html`
- Guardar en DB solo el path relativo

**3.5 — ScrapingService.scrapeUrl(retailerUrlId)**

Método principal:
1. Obtener la `RetailerUrl` de DB
2. Navegar con Playwright
3. Si la navegación falla: crear captura con `checkResult: 'error'`, actualizar `RetailerUrl.status = 'error'`, retornar
4. Extraer precio con `PriceExtractor`
5. Detectar promos con `PromoDetector`
6. Capturar evidencia
7. Crear registro `PriceCapture` en DB
8. Devolver el `PriceCapture` creado

**3.6 — Endpoint de prueba (solo development)**

```
POST /api/scraping/test          @Public() solo si NODE_ENV=development
Body: { retailerUrlId: number }
```

### Definición de Done del Sprint 3
- [ ] Dado una URL de MercadoLibre, se captura el precio correctamente
- [ ] Se detecta si hay precio tachado o texto de oferta
- [ ] Se guarda el screenshot en disco
- [ ] Se crea el registro `PriceCapture` en DB
- [ ] Los errores quedan registrados sin romper el sistema
- [ ] El endpoint de prueba funciona y devuelve datos reales

---

## Sprint 4 — Sistema de Jobs y Scheduler

**Meta:** El monitoreo corre automáticamente según la frecuencia configurada, con reintentos ante fallos.

### Tareas

**4.1 — Configurar BullMQ**

Crear `jobs/queues.config.ts`:
- Cola: `scraping-queue`
- Retry: 3 intentos, backoff exponencial de 5 segundos
- `removeOnComplete: 100`
- `removeOnFail: 200`
- Conexión a Redis con las variables de entorno

**4.2 — ScrapeProcessor (Worker)**

`jobs/scraping.processor.ts` con `@Processor('scraping-queue')`:
- Job `scrape-url` recibe `{ retailerUrlId: number }`
- Registrar en `JobLog` al iniciar y al finalizar
- Llamar a `ScrapingService.scrapeUrl(retailerUrlId)`
- En caso de error: loguear en `JobLog.error`, relanzar para que BullMQ maneje el retry

**4.3 — JobsService**

`jobs/jobs.service.ts`:
- Al iniciar (`onModuleInit`): leer `MonitoringConfig` de DB y crear el cron correspondiente
- El cron encola un job por cada `RetailerUrl` con `status = 'active'`
- `triggerManual(retailerUrlId?: number)`: encola uno o todos inmediatamente
- `updateConfig(frequency, isRunning)`: actualiza DB y reconfigura el cron en caliente

Mapeo de frecuencias a expresiones cron:
```
"1h"  → "0 * * * *"
"3h"  → "0 */3 * * *"
"6h"  → "0 */6 * * *"
"12h" → "0 */12 * * *"
"24h" → "0 8 * * *"    (todos los días a las 8am)
```

**4.4 — Endpoints de control** `@Roles('admin')`

```
GET   /api/jobs/config
PATCH /api/jobs/config                { frequency, isRunning }
POST  /api/jobs/trigger               encolar todos los activos
POST  /api/jobs/trigger/:id           encolar una URL específica
GET   /api/jobs/logs                  ?page&limit
```

### Definición de Done del Sprint 4
- [ ] Con `isRunning: true`, el scheduler encola jobs automáticamente
- [ ] Si un job falla, reintenta hasta 3 veces
- [ ] El historial de ejecuciones queda en `JobLog`
- [ ] Se puede cambiar la frecuencia desde la API sin reiniciar el servidor
- [ ] Se puede forzar un scraping manual desde la API

---

## Sprint 5 — Motor de Reglas y Alertas

**Meta:** Después de cada captura, el sistema evalúa las reglas y genera alertas con severidad correcta. Si hay alerta, se envía email.

### Tareas

**5.1 — RulesEngineService**

`rules-engine/rules-engine.service.ts`:

Método: `evaluate(capture: PriceCapture, product: Product, rules: MonitoringRule[]): AlertInput[]`

No tiene acceso a la DB. Lógica pura input/output:

| Tipo de regla | Condición de alerta |
|---|---|
| `exact_price` | `Math.abs(precio - targetPrice) / targetPrice > tolerance%` |
| `min_price` | `precio < minPrice` |
| `max_price` | `precio > maxPrice` |
| `range` | `precio < minPrice` o `precio > maxPrice` |
| `no_promo` | `hasPromo = true` o `struckPrice != null` o `promoText != null` |

Si `discountPct > maxDiscountPct` → escalar severidad a `critical`.

**5.2 — AlertsService**

`alerts/alerts.service.ts`:
- `createFromCapture(capture, retailerUrl, product)`: orquesta el motor de reglas y persiste alertas
- Deduplicación: si ya existe una alerta `open` del mismo tipo para el mismo `retailerUrlId`, no crear duplicado
- `updateStatus(id, status, comment, userId)`: gestión manual
- `findAll(filters)`: filtros por producto, retailer, severidad, status, fechas, paginado
- `getSummary()`: total por severidad y status

**5.3 — Integración en el processor**

En `ScrapeProcessor`, después del scraping:
1. Obtener producto y reglas activas
2. Llamar a `AlertsService.createFromCapture()`
3. Si se crearon alertas con severidad `warning` o `critical` → llamar a `NotificationsService.notify(alerts)`

**5.4 — EmailService**

`notifications/email.service.ts`:
- Usar Nodemailer con config SMTP desde `.env`
- Template HTML inline con: nombre del producto, retailer, precio detectado, precio esperado, tipo de alerta, link a la URL, severidad con color
- Si `SMTP_HOST` está vacío → loguear el email en consola (modo dev)

**5.5 — Endpoints de Alertas**

```
GET    /api/alerts                    ?productId&retailerUrlId&severity&status&from&to&page&limit
GET    /api/alerts/summary            { total, bySeverity, byStatus }
GET    /api/alerts/:id
PATCH  /api/alerts/:id    @Roles('admin')    { status, comment, resolutionComment, assignedUserId }
```

### Definición de Done del Sprint 5
- [ ] Un precio incorrecto genera una alerta en DB
- [ ] Una promo detectada genera una alerta `critical`
- [ ] No se duplican alertas para el mismo problema
- [ ] Se envía (o logea) un email con los detalles
- [ ] Un admin puede cambiar el status de una alerta

---

## Sprint 6 — Frontend MVP

**Meta:** Dashboard funcional con login, visualización de precios, alertas y administración básica.

### Tareas

**6.1 — Setup React**
```bash
cd frontend
npm install axios react-router-dom
npm install recharts @tanstack/react-table
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Crear `src/api/client.ts` con Axios:
- `baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api'`
- Interceptor de request: agregar `Authorization: Bearer {token}` desde el estado de auth
- Interceptor de response: si recibe 401 → intentar refresh token → si falla, redirigir a login

Crear `src/contexts/AuthContext.tsx`:
- Estado: `{ user, accessToken, isLoading }`
- Métodos: `login(email, password)`, `logout()`, `refreshToken()`
- Persistir `accessToken` en memoria (variable del contexto, no localStorage)
- Persistir `refreshToken` en httpOnly cookie (el backend lo setea vía `Set-Cookie`)

**6.2 — Rutas y protección**

```
/login                      → LoginPage         @Public
/                           → Dashboard         @Protected
/products                   → ProductsPage      @Protected
/products/new               → ProductForm       @Admin
/products/:id               → ProductDetail     @Protected
/alerts                     → AlertsPage        @Protected
/alerts/:id                 → AlertDetail       @Protected
/config                     → ConfigPage        @Admin
```

Crear componentes `ProtectedRoute` y `AdminRoute` que redirigen si no hay sesión o si no es admin.

**6.3 — LoginPage**

Formulario con email y password. Al hacer submit:
1. Llamar a `AuthContext.login()`
2. Si éxito → redirigir a `/`
3. Si error → mostrar mensaje de error

**6.4 — Dashboard principal (`/`)**

Tarjetas de resumen:
- Total retailers monitoreados
- Retailers con alerta activa (con color rojo si > 0)
- Capturas en las últimas 24h
- Alertas críticas abiertas

Tabla principal (TanStack Table):
- Columnas: Producto | Retailer | Último precio | Precio objetivo | Diferencia (%) | Estado | Última captura
- Estado con badge de color: verde=ok, amarillo=warning, rojo=critical, gris=error
- Filtros: por producto, por estado
- Ordenamiento por columna

**6.5 — Vista de Alertas (`/alerts`)**

Tabla con TanStack Table:
- Columnas: Severidad | Producto | Retailer | Tipo | Detectado | Esperado | Estado | Fecha
- Filtros: severidad, status, fecha desde/hasta
- Acción inline: dropdown para cambiar status (solo admin)
- Badge por severidad

**6.6 — Detalle de Producto (`/products/:id`)**

Secciones:
- Info del producto (nombre, SKU, precio objetivo, tolerancia)
- Tabla de URLs del retailer con su último precio y estado
- Gráfico de evolución de precios (Recharts):
  - Eje X: tiempo, Eje Y: precio
  - Una línea por retailer con color distinto
  - Línea de referencia horizontal = precio objetivo
  - Filtro de período: 7 días, 30 días, custom

**6.7 — Administración de Productos**

Vista `/products`:
- Tabla de productos con status y acción para activar/desactivar
- Botón "Nuevo producto" (solo admin)

Formulario (`/products/new` y `/products/:id/edit`):
- Campos: nombre, SKU, marca, categoría, precio objetivo, tolerancia
- Sección para gestionar URLs del retailer (agregar/quitar/cambiar estado)

**6.8 — Panel de control del Scheduler (`/config`)**

- Badge de estado: activo / pausado
- Selector de frecuencia
- Botón "Ejecutar ahora"
- Tabla de últimas 20 ejecuciones (JobLog)

### Definición de Done del Sprint 6
- [ ] El login funciona y redirige al dashboard
- [ ] Un `viewer` no puede acceder a rutas de admin
- [ ] El dashboard muestra precios actuales con colores por estado
- [ ] Las alertas activas son visibles
- [ ] El gráfico de evolución funciona con datos reales
- [ ] Se puede crear un producto y agregarle URLs
- [ ] El refresh token renueva la sesión automáticamente

---

## Sprint 7 — Reportes, Incidencias y Cierre

**Meta:** Exportación de datos, gestión de incidencias y sistema listo para demo.

### Tareas

**7.1 — Reporte Excel**

`GET /api/reports/excel?productId=X&from=YYYY-MM-DD&to=YYYY-MM-DD`

Tres hojas:
1. **Precios actuales**: retailer, URL, último precio, precio objetivo, diferencia, estado
2. **Histórico de capturas**: fecha, retailer, precio, promo detectada, check result
3. **Alertas**: fecha, tipo, severidad, retailer, precio detectado, precio esperado, estado, comentario

Estilos básicos con ExcelJS: header en negrita, colores por severidad en alertas, columnas con ancho ajustado.

**7.2 — Reporte CSV**

`GET /api/reports/csv/captures?productId=X&from=&to=`

Todas las capturas del período como CSV plano.

**7.3 — Botones de exportación en el frontend**

En `/products/:id` y en `/alerts`: botón "Exportar Excel" que llama al endpoint y descarga el archivo con nombre descriptivo (`reporte_precios_YYYY-MM-DD.xlsx`).

**7.4 — Gestión de incidencias completa**

Endpoint adicional: `GET /api/alerts/stats?from=&to=`
```json
{
  "total": 47,
  "bySeverity": { "critical": 12, "warning": 30, "info": 5 },
  "byStatus": { "open": 8, "in_review": 3, "resolved": 34, "dismissed": 2 },
  "avgResolutionHours": 4.2
}
```

**7.5 — Docker Compose para demo**

Asegurarse que `docker-compose up` levante todo con un solo comando:
- Backend compilado (`npm run build`)
- Frontend buildado y servido con `vite preview` o nginx
- Postgres con datos de seed
- Redis

**7.6 — Seed completo para demo**

`backend/prisma/seed.ts`:
- Usuario admin + 1 usuario viewer
- 1 producto Nestlé con precio objetivo
- 5-6 URLs de retailers (MercadoLibre, Coto, DIA, Carrefour, Walmart)
- 3 reglas: no_promo (critical), precio mínimo (warning), precio máximo (warning)
- 30 días de capturas históricas con variación realista de precios
- 10-15 alertas en distintos estados y severidades

**7.7 — GitHub Actions**

`.github/workflows/ci.yml`:
- Trigger: push a `main` y pull requests
- Jobs: install → lint → build backend → build frontend
- Variable secreta `JWT_SECRET` configurada en el repo

### Definición de Done del Sprint 7
- [ ] Se puede exportar un Excel con precios, capturas y alertas
- [ ] Con `docker-compose up` + seed la demo está lista en minutos
- [ ] El flujo completo funciona end-to-end: login → crear producto → agregar URL → ver captura → ver alerta → resolver alerta
- [ ] GitHub Actions corre sin errores

---

# ETAPA 2 — Versión Completa {#etapa2}

> ⛔ **STOP — NO IMPLEMENTAR HASTA QUE EL MVP ESTÉ COMPLETO Y VALIDADO**
>
> **Condición de entrada obligatoria:** todos los sprints de la Etapa 1 (Sprint 0 al Sprint 7) deben estar finalizados, testeados y con su Definición de Done cumplida.
>
> Si estás en medio del MVP y lees algo aquí (Stagehand, MinIO, PDFKit, Teams, etc.), **ignorarlo por completo**. Esas decisiones ya están reflejadas en el schema y en la arquitectura del MVP para no tener que reescribir después, pero el código no se toca hasta esta etapa.
>
> Las fases de esta etapa **no son secuenciales obligatorias**: se priorizan según qué problema duele más en producción en ese momento.

---

## Fase A — Observabilidad y Hardening

*Primer paso post-MVP. Casi obligatoria antes de que el cliente lo use en producción real.*

**A.1 — Logging estructurado con Pino**

Reemplazar `console.log` por Pino. Configurar: nivel por env (`debug` en dev, `info` en prod), output JSON en prod, pretty print en dev. Loguear: cada request (método, path, status, duración), cada job de scraping (URL, resultado, duración), cada alerta generada, cada error con stack trace.

**A.2 — Bull Board**

Montar el panel de BullMQ en `/admin/queues` (protegido con JWT + rol admin). Muestra: jobs en cola, en proceso, completados y fallidos en tiempo real. Permite reintentar jobs fallidos manualmente.

**A.3 — OWASP Hardening completo**

- Audit de dependencias con `npm audit` automatizado en CI
- Validación exhaustiva de todas las URLs ingresadas (evitar SSRF)
- Los paths de screenshots y HTML deben validarse para evitar path traversal
- Rotate JWT secrets sin downtime (soportar múltiples secrets activos)
- Configurar `SameSite=Strict` en la cookie del refresh token

**A.4 — Métricas de calidad del scraping**

Nuevo endpoint: `GET /api/reports/scraping-health`
- Tasa de éxito por retailer (últimos 7 días)
- Tiempo promedio de scraping por retailer
- Frecuencia de fallos por tipo de error
- Visualizarlo en un nuevo panel en el frontend

---

## Fase B — Stagehand: Scraping Inteligente

*Priorizar cuando haya fallos frecuentes de scraping por cambios de DOM.*

**Concepto: extractor híbrido**

```
Para cada URL:
  1. Intentar extracción con JSON-LD / selectores aprendidos (rápido, gratis)
  2. Si falla o confianza baja → escalar a Stagehand (LLM)
  3. Stagehand extrae el precio Y genera el selector CSS correspondiente
  4. Persistir ese selector en RetailerUrl.learnedSelector
  5. La próxima vez, usar el selector aprendido antes de llamar al LLM
```

**B.1 — Instalar Stagehand**
```bash
npm install @browserbasehq/stagehand zod
```

**B.2 — StagehandExtractor**

Crear `scraping/extractors/stagehand.extractor.ts`:
```typescript
const result = await stagehand.extract({
  instruction: "extraé el precio actual del producto (sin descuentos ni promociones), el precio tachado si existe, y cualquier texto promocional visible",
  schema: z.object({
    currentPrice: z.number().nullable(),
    struckPrice: z.number().nullable(),
    promoText: z.string().nullable(),
    cssSelector: z.string().nullable(), // el selector donde encontró el precio
  })
});
```

**B.3 — Actualizar el flujo en ScrapingService**

```typescript
// Nuevo flujo con fallback inteligente
let result = await this.priceExtractor.extractFast(page, retailerUrl.learnedSelector);
if (!result || result.confidence < 0.8) {
  result = await this.stagehandExtractor.extract(url);
  if (result?.cssSelector) {
    await this.retailerUrlsService.updateLearnedSelector(retailerUrl.id, result.cssSelector);
  }
}
```

**B.4 — Detección avanzada de promociones con Stagehand**

Para casos donde la promo es visual (banner, imagen, tooltip), usar Stagehand con una instrucción específica: "¿existe algún indicador visual de promoción, descuento o precio especial en esta página? Describilo si existe."

---

## Fase C — Almacenamiento Avanzado y Reportes Completos

*Priorizar cuando el volumen de screenshots empiece a crecer o el cliente pida PDF / Teams.*

**C.1 — MinIO**

Agregar MinIO al `docker-compose.yml`:
```yaml
minio:
  image: minio/minio
  ports:
    - "9000:9000"
    - "9001:9001"  # consola web
  volumes:
    - minio_data:/data
  command: server /data --console-address ":9001"
```

Crear `storage/storage.service.ts` con interfaz común:
```typescript
interface StorageService {
  save(key: string, buffer: Buffer, mimeType: string): Promise<string>; // devuelve URL
  getUrl(key: string): string;
}
```

Implementación `LocalStorageService` (MVP, ya existe) e implementación `MinioStorageService`. El módulo elige cuál usar según la variable de entorno `STORAGE_DRIVER=local|minio`.

**C.2 — PDFKit para reportes ejecutivos**

Nuevo endpoint: `GET /api/reports/pdf?productId=X&from=&to=`

El PDF incluye: portada con logo y fecha, resumen ejecutivo (métricas clave del período), tabla de precios actuales, gráfico de evolución (generar imagen server-side con `chartjs-node-canvas`), listado de incidentes detectados.

**C.3 — Teams Webhooks**

Agregar a `NotificationsService.notify()`:
- Leer `TEAMS_WEBHOOK_URL` del env
- Si está configurado, enviar un mensaje con Adaptive Card: título con severidad, datos de la alerta, botón "Ver en el sistema" con link
- Implementar como canal paralelo al email, no como reemplazo

**C.4 — Microsoft Graph (si Nestlé lo requiere)**

Reemplazar Nodemailer con el SDK de Microsoft Graph:
```bash
npm install @microsoft/microsoft-graph-client @azure/identity
```
Requiere: registro de app en Azure AD, permisos `Mail.Send`, client ID y secret en variables de entorno.

---

## Fase D — Escala y Multi-Producto

*Cuando el sistema pase de un producto a múltiples, o de Argentina a otros mercados.*

**D.1 — Multi-producto en el dashboard**

El dashboard ya soporta múltiples productos en el schema. Lo que hay que agregar:
- Selector de producto en el header del dashboard (o vista "todos los productos")
- Métricas agregadas cross-producto: cuántos productos con alerta, ranking de retailers por compliance
- Exportar reporte consolidado multi-producto

**D.2 — Multi-mercado**

Agregar campo `country` a `MonitoringConfig` y lógica de zonas horarias para el scheduler (el cron de Argentina no es el mismo que el de México).

**D.3 — Cloudflare Browser Rendering**

Solo evaluar si el volumen supera ~50 retailers × cada hora. Cloudflare gestiona el pool de browsers, el sistema solo manda la URL y recibe el HTML ya renderizado. Reemplaza el `PlaywrightService` sin cambiar la interfaz del `ScrapingService`.

**D.4 — Docker Hub**

Agregar a GitHub Actions un job adicional:
- Buildear la imagen del backend y del frontend
- Pushear a Docker Hub con tag de versión y `latest`
- Permite hacer rollback limpio a cualquier versión anterior

**D.5 — Integración con BI**

Exponer un endpoint de datos agregados para consumo desde Power BI o Looker:
`GET /api/reports/bi-feed?from=&to=` → JSON con estructura optimizada para pivot tables.

---

# Guía de Sesiones en Claude Code {#sesiones}

Usar este bloque al inicio de cada sesión:

```
Proyecto: Sistema de Monitoreo de Precios — Nestlé
Etapa: [MVP / Etapa 2]
Sprint / Fase: [ej: Sprint 3 — Motor de Scraping]
Tarea actual: [ej: 3.2 — PriceExtractor]
Estado: [qué está terminado, qué falta en esta tarea]
Problema puntual (si aplica): [descripción específica]
```

**Ejemplo:**
```
Proyecto: Sistema de Monitoreo de Precios — Nestlé
Etapa: MVP
Sprint / Fase: Sprint 3 — Motor de Scraping
Tarea actual: 3.2 — PriceExtractor
Estado: PlaywrightService (3.1) completo. PriceExtractor implementado para JSON-LD
        y meta tags. Falla la estrategia de selectores CSS en MercadoLibre.
Problema puntual: MercadoLibre usa un precio renderizado con JS que no está en el
                  JSON-LD cuando el producto tiene variantes. El precio aparece en
                  un elemento con clase dinámica.
```

---

# Notas sobre Retailers Argentinos {#retailers}

Al implementar el `PriceExtractor` en el Sprint 3, tener en cuenta las particularidades de cada retailer:

**MercadoLibre**: expone JSON-LD completo con `@type: Product` y `offers.price`. Es la fuente más confiable. El complicador son las variantes de producto (talle, color): el precio puede cambiar según la variante seleccionada. Capturar el precio de la variante por defecto.

**Coto**: expone una API JSON propia para fichas de producto. Conviene inspeccionar los requests de red de la página con `page.route()` de Playwright e interceptar el JSON en lugar de parsear el HTML. Es más estable que cualquier selector.

**DIA**: contenido dinámico. Requiere `waitForSelector('.price-now')` antes de extraer. Tiene precios diferenciados por tarjeta de fidelidad: capturar el precio base y marcar el precio de tarjeta como posible señal de promoción.

**Carrefour / Maison**: precios diferenciados por tarjeta Carrefour. El precio base y el precio con tarjeta suelen aparecer juntos. Tratar el precio con tarjeta como `promoType: 'payment_method'`.

**Walmart / Changomas**: estructura similar a Carrefour. Verificar si comparten el mismo motor de e-commerce.

Para todos los retailers: antes de implementar el selector, inspeccionar manualmente la página con DevTools, buscar primero el JSON-LD, y documentar en un comentario en el código qué estrategia se usó y por qué.
