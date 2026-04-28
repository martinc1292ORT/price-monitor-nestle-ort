# Price Monitor Nestlé — Backlog Completo de Tickets Jira

## Metadata del proyecto

- PROJECT_KEY: PMN
- BOARD: Price Monitor Nestlé-ORT
- TOTAL_TICKETS: 61
- SPRINTS: S00, S01, S02, S03, S04, S05, S06, S07

## Instrucciones para Claude Code

Crear cada ticket en Jira usando los campos exactos de cada bloque TICKET.
Mapeo de campos:

- TITULO → Summary
- TIPO → Issue Type
- SPRINT → Sprint (label o campo sprint según configuración del board)
- STORY_POINTS → Story Points
- PRIORIDAD → Priority
- ESTADO → Status inicial
- DESCRIPCION → Description (cuerpo principal)
- CRITERIOS → Agregar al final de Description bajo el subtítulo "## Criterios de aceptación"
- DEPENDENCIAS → Linked issues (tipo "is blocked by")
- BRANCH → Agregar en Description bajo el subtítulo "## Branch sugerido"

Procesar todos los tickets en orden. Si alguno falla, continuar con el siguiente y reportar errores al final.

---

## ═══════════════════════════════════════════

## SPRINT S04 — Sistema de Jobs y Scheduler

## ═══════════════════════════════════════════

### TICKET

- KEY: PMN-39
- TITULO: S04 - [BE] Configurar BullMQ — cola de scraping con reintentos
- TIPO: Task
- SPRINT: S04 - Sistema de Jobs y Scheduler
- STORY_POINTS: 3
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/jobs/queues.config.ts con la configuración de BullMQ para la cola de scraping.

  Configuración de la cola scraping-queue:

  - Retry: 3 intentos con backoff exponencial de 5 segundos
  - removeOnComplete: 100 (mantener últimos 100 jobs completados)
  - removeOnFail: 200 (mantener últimos 200 jobs fallidos)
  - Conexión a Redis usando REDIS_HOST y REDIS_PORT del .env

  Registrar la cola en jobs.module.ts usando BullModule.registerQueue().

- CRITERIOS:
  - La cola se conecta a Redis correctamente al iniciar la app
  - Si un job falla, reintenta hasta 3 veces con backoff exponencial
  - Los jobs completados y fallidos se limpian automáticamente según los límites configurados
- DEPENDENCIAS: PMN-36
- BRANCH: feature/PMN-39-bullmq-config

---

### TICKET

- KEY: PMN-40
- TITULO: S04 - [BE] Implementar ScrapeProcessor (worker BullMQ)
- TIPO: Task
- SPRINT: S04 - Sistema de Jobs y Scheduler
- STORY_POINTS: 3
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/jobs/scraping.processor.ts con el decorator @Processor('scraping-queue').

  Procesador del job 'scrape-url':

  - Recibe payload: { retailerUrlId: number }
  - Registrar en JobLog al iniciar: status = 'started'
  - Llamar a ScrapingService.scrapeUrl(retailerUrlId)
  - Registrar en JobLog al finalizar: status = 'completed', duration en ms
  - En caso de error: registrar en JobLog con status = 'failed' y el error message, luego relanzar para que BullMQ maneje el retry

  El JobLog debe quedar con:

  - jobId: id del job BullMQ
  - jobName: 'scrape-url'
  - status: 'started' | 'completed' | 'failed'
  - retailerUrlId
  - error: mensaje de error si aplica
  - duration: milisegundos que tomó

- CRITERIOS:
  - Cada ejecución crea un registro en JobLog con el resultado
  - Los errores quedan registrados en JobLog antes de relanzar para retry
  - Si el job falla 3 veces, queda en estado 'failed' en BullMQ con el error documentado
- DEPENDENCIAS: PMN-39
- BRANCH: feature/PMN-40-scrape-processor

---

### TICKET

- KEY: PMN-41
- TITULO: S04 - [BE] Implementar JobsService (scheduler node-cron + encolado automático)
- TIPO: Task
- SPRINT: S04 - Sistema de Jobs y Scheduler
- STORY_POINTS: 3
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/jobs/jobs.service.ts que orquesta el scheduler y el encolado de jobs.

  Comportamiento en onModuleInit():

  - Leer MonitoringConfig de DB
  - Si isRunning = true, crear el cron correspondiente a la frecuencia configurada

  El cron encola un job 'scrape-url' en scraping-queue por cada RetailerUrl con status = 'active'.

  Método triggerManual(retailerUrlId?: number):

  - Sin parámetro: encola todas las URLs activas inmediatamente
  - Con parámetro: encola solo la URL especificada

  Método updateConfig(frequency, isRunning):

  - Actualiza MonitoringConfig en DB
  - Destruye el cron actual y crea uno nuevo con la nueva frecuencia
  - Si isRunning = false, destruye el cron sin crear uno nuevo

  Mapeo de frecuencias a expresiones cron:

  - "1h" → "0 \* \* \* \*"
  - "3h" → "0 _/3 _ \* \*"
  - "6h" → "0 _/6 _ \* \*"
  - "12h" → "0 _/12 _ \* \*"
  - "24h" → "0 8 \* \* \*" (todos los días a las 8am)

- CRITERIOS:
  - Con isRunning: true, el scheduler encola jobs automáticamente según la frecuencia
  - Se puede cambiar la frecuencia desde la API sin reiniciar el servidor
  - triggerManual() encola jobs inmediatamente sin esperar el cron
- DEPENDENCIAS: PMN-40
- BRANCH: feature/PMN-41-jobs-service

---

### TICKET

- KEY: PMN-42
- TITULO: S04 - [BE] Implementar endpoints de control del scheduler
- TIPO: Task
- SPRINT: S04 - Sistema de Jobs y Scheduler
- STORY_POINTS: 2
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/jobs/jobs.controller.ts con endpoints de administración del scheduler.

  Todos los endpoints requieren @Roles('admin'):

  GET /api/jobs/config → Retorna MonitoringConfig actual { frequency, isRunning }
  PATCH /api/jobs/config → Body: { frequency?, isRunning? } → Actualiza config y reconfigura cron
  POST /api/jobs/trigger → Encola todas las URLs activas inmediatamente
  POST /api/jobs/trigger/:id → Encola una URL específica por retailerUrlId
  GET /api/jobs/logs → Historial de ejecuciones paginado (?page&limit)

- CRITERIOS:
  - PATCH /api/jobs/config con frequency: '1h' reconfigura el cron en caliente
  - PATCH /api/jobs/config con isRunning: false detiene el scheduler sin reiniciar el servidor
  - POST /api/jobs/trigger crea jobs en la cola verificables en BullMQ
  - GET /api/jobs/logs retorna los últimos registros de JobLog paginados
- DEPENDENCIAS: PMN-41
- BRANCH: feature/PMN-42-jobs-controller

---

### TICKET

- KEY: PMN-43
- TITULO: S04 - [QA] Pruebas de integración manuales Sprint 4
- TIPO: Task
- SPRINT: S04 - Sistema de Jobs y Scheduler
- STORY_POINTS: 1
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Verificar el funcionamiento completo del sistema de jobs y scheduler.

  Checklist:

  - POST /api/jobs/trigger encola jobs para todas las URLs activas
  - Los jobs se procesan y crean PriceCapture en DB
  - Si un job falla, reintenta hasta 3 veces
  - Los reintentos quedan en JobLog con status 'failed'
  - GET /api/jobs/logs muestra el historial paginado
  - PATCH /api/jobs/config con frequency: '1h' reconfigura el cron
  - PATCH /api/jobs/config con isRunning: false detiene el scheduler
  - POST /api/jobs/trigger/:id encola solo la URL especificada

  Documentar resultados en comentarios del ticket.

- CRITERIOS:
  - Todos los ítems del checklist verificados y documentados
  - Ningún blocker antes de iniciar Sprint 5
- DEPENDENCIAS: PMN-42
- BRANCH: ninguno (tarea de QA)

---

## ═══════════════════════════════════════════════

## SPRINT S05 — Motor de Reglas y Alertas

## ═══════════════════════════════════════════════

### TICKET

- KEY: PMN-44
- TITULO: S05 - [BE] Implementar RulesEngineService (lógica pura input/output)
- TIPO: Task
- SPRINT: S05 - Motor de Reglas y Alertas
- STORY_POINTS: 3
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/rules-engine/rules-engine.service.ts.

  IMPORTANTE: este servicio no tiene acceso directo a la DB. Es lógica pura input/output para facilitar el testing.

  Método principal:
  evaluate(capture: PriceCapture, product: Product, rules: MonitoringRule[]): AlertInput[]

  Lógica por tipo de regla:

  - exact_price: abs(precio - targetPrice) / targetPrice > tolerance% → alerta
  - min_price: precio < minPrice → alerta
  - max_price: precio > maxPrice → alerta
  - range: precio < minPrice o precio > maxPrice → alerta
  - no_promo: hasPromo = true o struckPrice != null o promoText != null → alerta

  Regla adicional: si discountPct > maxDiscountPct → escalar severidad a 'critical'.

  AlertInput retornado por cada regla violada:
  { type, severity, detectedValue, expectedValue, description }

- CRITERIOS:
  - Un precio igual al targetPrice no genera alertas
  - Un precio 5% más bajo que targetPrice con tolerance 2% genera una alerta
  - hasPromo: true con regla no_promo genera una alerta critical
  - El servicio no llama a la DB en ningún momento (lógica pura)
- DEPENDENCIAS: PMN-36
- BRANCH: feature/PMN-44-rules-engine

---

### TICKET

- KEY: PMN-45
- TITULO: S05 - [BE] Implementar AlertsService (creación, deduplicación, gestión)
- TIPO: Task
- SPRINT: S05 - Motor de Reglas y Alertas
- STORY_POINTS: 5
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/alerts/alerts.service.ts.

  Método createFromCapture(capture, retailerUrl, product):

  1. Obtener reglas activas del producto desde DB
  2. Llamar a RulesEngineService.evaluate(capture, product, rules)
  3. Por cada AlertInput retornado:
     - Deduplicación: si ya existe una Alert open del mismo type para el mismo retailerUrlId, no crear duplicado
     - Si no existe duplicado: crear Alert en DB
  4. Retornar las alertas creadas

  Método updateStatus(id, status, comment, resolutionComment, assignedUserId):

  - Actualizar status: 'open' | 'in_review' | 'resolved' | 'dismissed'
  - Si status = 'resolved': setear resolvedAt = now()

  Método findAll(filters): filtros por productId, retailerUrlId, severity, status, from, to. Con paginación.

  Método getSummary(): { total, bySeverity: { critical, warning, info }, byStatus: { open, in_review, resolved, dismissed } }

- CRITERIOS:
  - Un precio incorrecto genera una alerta en DB
  - No se duplican alertas para el mismo problema activo (misma URL + mismo tipo)
  - Un admin puede cambiar el status de una alerta
  - resolvedAt se setea automáticamente al resolver
- DEPENDENCIAS: PMN-44
- BRANCH: feature/PMN-45-alerts-service

---

### TICKET

- KEY: PMN-46
- TITULO: S05 - [BE] Integrar motor de reglas en ScrapeProcessor
- TIPO: Task
- SPRINT: S05 - Motor de Reglas y Alertas
- STORY_POINTS: 2
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Actualizar backend/src/jobs/scraping.processor.ts para que después del scraping evalúe las reglas y genere alertas.

  Flujo actualizado del processor:

  1. Ejecutar ScrapingService.scrapeUrl(retailerUrlId) → PriceCapture
  2. Obtener producto y reglas activas
  3. Llamar a AlertsService.createFromCapture(capture, retailerUrl, product)
  4. Si se crearon alertas con severidad 'warning' o 'critical': llamar a NotificationsService.notify(alerts)
  5. Registrar en JobLog con resultado final

- CRITERIOS:
  - Después de cada scraping exitoso se evalúan las reglas automáticamente
  - Si hay desvío de precio, se crea la alerta en DB automáticamente
  - La notificación se dispara solo para alertas warning o critical
  - El flujo completo queda registrado en JobLog
- DEPENDENCIAS: PMN-45
- BRANCH: feature/PMN-46-processor-alerts-integration

---

### TICKET

- KEY: PMN-47
- TITULO: S05 - [BE] Implementar EmailService (Nodemailer + template HTML de alerta)
- TIPO: Task
- SPRINT: S05 - Motor de Reglas y Alertas
- STORY_POINTS: 3
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/notifications/email.service.ts usando Nodemailer.

  Configuración:

  - Leer SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL_FROM, ALERT_EMAIL_TO del .env
  - Si SMTP_HOST está vacío: loguear el email en consola (modo dev) sin intentar enviar

  Template HTML del email de alerta (inline) debe incluir:

  - Nombre del producto
  - Retailer afectado
  - Precio detectado
  - Precio esperado
  - Tipo de alerta
  - Link a la URL del retailer
  - Badge de severidad con color (critical = rojo, warning = naranja, info = azul)
  - Fecha y hora de detección

  Método notify(alerts: Alert[]): enviar un email por cada alerta o uno consolidado con todas.

- CRITERIOS:
  - Con SMTP configurado, el email se envía correctamente
  - Sin SMTP configurado, el contenido del email se loguea en consola
  - El template HTML es legible y contiene toda la información relevante
- DEPENDENCIAS: PMN-45
- BRANCH: feature/PMN-47-email-service

---

### TICKET

- KEY: PMN-48
- TITULO: S05 - [BE] Implementar endpoints REST de alertas
- TIPO: Task
- SPRINT: S05 - Motor de Reglas y Alertas
- STORY_POINTS: 2
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/alerts/alerts.controller.ts.

  Endpoints:
  GET /api/alerts Autenticado → Listar alertas con filtros y paginación
  (?productId&retailerUrlId&severity&status&from&to&page&limit)
  GET /api/alerts/summary Autenticado → { total, bySeverity, byStatus }
  GET /api/alerts/:id Autenticado → Detalle de alerta
  PATCH /api/alerts/:id @Roles('admin') → Actualizar status, comment, resolutionComment, assignedUserId

- CRITERIOS:
  - Un viewer puede ver alertas pero no actualizarlas
  - GET /api/alerts/summary retorna conteos correctos por severidad y status
  - PATCH /api/alerts/:id actualiza el status y setea resolvedAt si status = 'resolved'
  - Los filtros de fecha (from, to) funcionan correctamente
- DEPENDENCIAS: PMN-45
- BRANCH: feature/PMN-48-alerts-controller

---

### TICKET

- KEY: PMN-49
- TITULO: S05 - [QA] Pruebas de integración manuales Sprint 5
- TIPO: Task
- SPRINT: S05 - Motor de Reglas y Alertas
- STORY_POINTS: 1
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Verificar el funcionamiento completo del motor de reglas y alertas.

  Checklist:

  - Scraping de una URL con precio correcto → no genera alerta
  - Scraping de una URL con precio fuera de rango → genera alerta en DB
  - Scraping con promo detectada → genera alerta critical en DB
  - Ejecutar dos veces el scraping con el mismo desvío → solo existe una alerta open (no duplicado)
  - GET /api/alerts retorna las alertas generadas
  - GET /api/alerts/summary retorna conteos correctos
  - PATCH /api/alerts/:id con status: 'resolved' → resolvedAt se setea y el status cambia
  - Email de alerta se loguea en consola (modo dev sin SMTP)

  Documentar resultados en comentarios del ticket.

- CRITERIOS:
  - Todos los ítems del checklist verificados y documentados
  - Ningún blocker antes de iniciar Sprint 6
- DEPENDENCIAS: PMN-46, PMN-47, PMN-48
- BRANCH: ninguno (tarea de QA)

---

## ═══════════════════════════════════════

## SPRINT S06 — Frontend MVP

## ═══════════════════════════════════════

### TICKET

- KEY: PMN-50
- TITULO: S06 - [FE] Setup React: Axios client, interceptors y AuthContext
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 3
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Configurar la base del frontend para comunicación con la API y gestión de autenticación.

  frontend/src/api/client.ts (Axios):

  - baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
  - Interceptor de request: agregar Authorization: Bearer {token} desde el estado de auth
  - Interceptor de response: si recibe 401 → intentar refresh token → si falla, redirigir a /login

  frontend/src/contexts/AuthContext.tsx:

  - Estado: { user, accessToken, isLoading }
  - Métodos: login(email, password), logout(), refreshToken()
  - accessToken: guardar en memoria (variable del contexto, NO localStorage)
  - refreshToken: el backend lo setea vía httpOnly cookie (Set-Cookie)

  Instalar dependencias:
  npm install axios react-router-dom recharts @tanstack/react-table
  npm install -D tailwindcss postcss autoprefixer
  npx tailwindcss init -p

- CRITERIOS:
  - El cliente Axios incluye el token en cada request automáticamente
  - Al recibir 401, intenta el refresh antes de redirigir al login
  - El accessToken nunca se almacena en localStorage
  - AuthContext está disponible en toda la aplicación via Provider en main.tsx
- DEPENDENCIAS: PMN-21
- BRANCH: feature/PMN-50-fe-setup

---

### TICKET

- KEY: PMN-51
- TITULO: S06 - [FE] Rutas protegidas y componentes ProtectedRoute / AdminRoute
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 2
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Configurar el sistema de rutas de la aplicación con protección por autenticación y rol.

  Estructura de rutas:
  /login → LoginPage Pública
  / → Dashboard Protegida (requiere login)
  /products → ProductsPage Protegida
  /products/new → ProductForm Solo admin
  /products/:id → ProductDetail Protegida
  /alerts → AlertsPage Protegida
  /alerts/:id → AlertDetail Protegida
  /config → ConfigPage Solo admin

  Componentes a crear:

  - ProtectedRoute: redirige a /login si no hay sesión activa
  - AdminRoute: redirige a / con un toast de "Sin permisos" si el usuario no es admin

- CRITERIOS:
  - Un usuario sin sesión que accede a / es redirigido a /login
  - Un viewer que intenta acceder a /products/new es redirigido a /
  - Después del login exitoso se redirige a la ruta original solicitada
- DEPENDENCIAS: PMN-50
- BRANCH: feature/PMN-51-fe-routes

---

### TICKET

- KEY: PMN-52
- TITULO: S06 - [FE] LoginPage con formulario de autenticación
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 2
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear frontend/src/pages/LoginPage.tsx con el formulario de login.

  Campos del formulario:

  - Email (input type email, required)
  - Password (input type password, required)
  - Botón "Iniciar sesión"

  Comportamiento:

  1. Al hacer submit, llamar a AuthContext.login(email, password)
  2. Mostrar spinner/loading mientras se procesa
  3. Si éxito: redirigir a /
  4. Si error: mostrar mensaje de error bajo el formulario (ej: "Credenciales inválidas")

  Estilos: Tailwind CSS, diseño centrado, responsivo. Incluir logo o nombre del sistema.

- CRITERIOS:
  - Login exitoso redirige al dashboard
  - Credenciales incorrectas muestran mensaje de error sin recargar la página
  - El botón muestra estado de loading durante el request
  - El formulario es usable en mobile
- DEPENDENCIAS: PMN-51
- BRANCH: feature/PMN-52-fe-login

---

### TICKET

- KEY: PMN-53
- TITULO: S06 - [FE] Dashboard principal — tarjetas de resumen + tabla de estado de precios
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 5
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear frontend/src/pages/DashboardPage.tsx — pantalla principal del sistema.

  Tarjetas de resumen (parte superior):

  - Total retailers monitoreados
  - Retailers con alerta activa (badge rojo si > 0)
  - Capturas en las últimas 24h
  - Alertas críticas abiertas

  Tabla principal con TanStack Table:
  Columnas: Producto | Retailer | Último precio | Precio objetivo | Diferencia (%) | Estado | Última captura

  Badge de estado por color:

  - Verde: checkResult = 'ok'
  - Amarillo: checkResult = 'deviation' o alertas warning
  - Rojo: alertas critical
  - Gris: checkResult = 'error'

  Filtros sobre la tabla: por producto, por estado
  Ordenamiento: por cualquier columna al hacer click en el header

- CRITERIOS:
  - Las tarjetas muestran datos reales consumidos de la API
  - La tabla muestra el estado actualizado de cada retailer
  - Los badges de estado son visualmente distinguibles
  - Los filtros funcionan sobre los datos ya cargados (client-side)
- DEPENDENCIAS: PMN-52, PMN-26, PMN-48
- BRANCH: feature/PMN-53-fe-dashboard

---

### TICKET

- KEY: PMN-54
- TITULO: S06 - [FE] Vista de Alertas — tabla con filtros y gestión de estado
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 3
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear frontend/src/pages/AlertsPage.tsx con la tabla de alertas.

  Tabla TanStack Table:
  Columnas: Severidad | Producto | Retailer | Tipo | Detectado | Esperado | Estado | Fecha

  Filtros disponibles:

  - Por severidad: critical / warning / info
  - Por status: open / in_review / resolved / dismissed
  - Por fecha: desde / hasta (date picker)

  Acción inline en cada fila (solo admin):

  - Dropdown para cambiar status de la alerta
  - Opciones: En revisión / Resuelto / Descartado

  Badge de severidad con colores:

  - Critical: rojo
  - Warning: naranja
  - Info: azul

- CRITERIOS:
  - La tabla carga alertas reales de la API
  - Los filtros son funcionales y pueden combinarse
  - Un admin puede cambiar el status desde la tabla directamente
  - Un viewer ve la tabla pero no tiene el dropdown de acciones
- DEPENDENCIAS: PMN-53, PMN-48
- BRANCH: feature/PMN-54-fe-alerts

---

### TICKET

- KEY: PMN-55
- TITULO: S06 - [FE] Detalle de Producto — info + tabla de URLs + gráfico Recharts
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 5
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear frontend/src/pages/ProductDetailPage.tsx con tres secciones.

  Sección 1 — Info del producto:

  - Nombre, SKU, precio objetivo, tolerancia, estado, fechas de vigencia

  Sección 2 — Tabla de URLs del retailer:

  - Columnas: Retailer | URL | Último precio | Estado | Última captura
  - Badge de estado por color

  Sección 3 — Gráfico de evolución de precios (Recharts LineChart):

  - Eje X: tiempo
  - Eje Y: precio
  - Una línea por retailer con color distinto
  - Línea de referencia horizontal = precio objetivo (ReferenceLine)
  - Selector de período: 7 días | 30 días | personalizado (date range picker)

  Consumir datos del endpoint GET /api/captures (o equivalente) filtrado por productId y período.

- CRITERIOS:
  - El gráfico muestra datos reales con una línea por retailer
  - La línea de precio objetivo es visible y diferenciada
  - El selector de período filtra los datos del gráfico
  - La tabla de URLs muestra el precio más reciente de cada retailer
- DEPENDENCIAS: PMN-53
- BRANCH: feature/PMN-55-fe-product-detail

---

### TICKET

- KEY: PMN-56
- TITULO: S06 - [FE] Administración de Productos — CRUD y gestión de URLs
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 3
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Crear frontend/src/pages/ProductsPage.tsx y el formulario de producto.

  ProductsPage (/products):

  - Tabla de productos con columnas: Nombre | SKU | Precio objetivo | Estado | Acciones
  - Botón "Nuevo producto" visible solo para admin
  - Acción de activar/desactivar por fila (solo admin)

  Formulario (/products/new y /products/:id/edit):

  - Campos: nombre, SKU, marca, categoría, precio objetivo, tolerancia
  - Sección de gestión de URLs del retailer: listar URLs existentes, agregar nueva URL (retailer + URL), cambiar estado de URL existente
  - Validación client-side antes de enviar

  Feedback visual:

  - Spinner durante el guardado
  - Toast de éxito/error al completar la operación

- CRITERIOS:
  - Solo un admin ve el botón "Nuevo producto" y el formulario de edición
  - El formulario valida que el precio objetivo sea mayor que 0
  - Se puede agregar y eliminar URLs de retailer desde el formulario
  - Toast de confirmación al guardar o error al fallar
- DEPENDENCIAS: PMN-54, PMN-26, PMN-28
- BRANCH: feature/PMN-56-fe-products-admin

---

### TICKET

- KEY: PMN-57
- TITULO: S06 - [FE] Panel de control del Scheduler (/config)
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 2
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Crear frontend/src/pages/ConfigPage.tsx — panel de administración del scheduler. Solo accesible para admin.

  Secciones:

  Estado del scheduler:

  - Badge verde "Activo" / rojo "Pausado" según isRunning
  - Selector de frecuencia: 1h | 3h | 6h | 12h | 24h
  - Botón "Guardar configuración"
  - Botón "Ejecutar ahora" → llama a POST /api/jobs/trigger

  Historial de ejecuciones:

  - Tabla con los últimos 20 JobLog: fecha | URL | status | duración | error
  - Badges de color: verde=completed, rojo=failed, gris=started
  - Actualización automática cada 30 segundos (polling)

- CRITERIOS:
  - Cambiar la frecuencia y guardar reconfigura el scheduler via API
  - "Ejecutar ahora" dispara el scraping y aparece feedback visual
  - La tabla de historial muestra datos reales y se refresca automáticamente
  - Un viewer que intente acceder es redirigido
- DEPENDENCIAS: PMN-56, PMN-42
- BRANCH: feature/PMN-57-fe-config

---

### TICKET

- KEY: PMN-58
- TITULO: S06 - [QA] Pruebas de integración manuales Sprint 6
- TIPO: Task
- SPRINT: S06 - Frontend MVP
- STORY_POINTS: 2
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Verificar el funcionamiento completo del frontend MVP.

  Checklist:

  - Login exitoso redirige al dashboard
  - Login con credenciales incorrectas muestra error sin recargar
  - Un viewer no puede acceder a /products/new ni a /config
  - El dashboard muestra precios actuales con colores por estado
  - Las alertas activas son visibles en /alerts
  - El gráfico de evolución de precios en detalle de producto carga datos reales
  - Se puede crear un producto y agregarle URLs desde el formulario
  - Se puede cambiar el status de una alerta desde la tabla (como admin)
  - El refresh token renueva la sesión automáticamente (verificar que el accessToken se renueva al expirar)
  - La app es usable en mobile (responsive básico)

  Documentar resultados en comentarios del ticket.

- CRITERIOS:
  - Todos los ítems del checklist verificados y documentados
  - Ningún blocker antes de iniciar Sprint 7
- DEPENDENCIAS: PMN-57
- BRANCH: ninguno (tarea de QA)

---

## ═══════════════════════════════════════════════════════

## SPRINT S07 — Reportes, Incidencias y Cierre

## ═══════════════════════════════════════════════════════

### TICKET

- KEY: PMN-59
- TITULO: S07 - [BE] Reporte Excel con ExcelJS (precios, capturas y alertas)
- TIPO: Task
- SPRINT: S07 - Reportes, Incidencias y Cierre
- STORY_POINTS: 3
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Crear backend/src/reports/reports.service.ts con generación de reporte Excel usando ExcelJS.

  Endpoint: GET /api/reports/excel?productId=X&from=YYYY-MM-DD&to=YYYY-MM-DD

  El archivo Excel tiene tres hojas:

  Hoja 1 — Precios actuales:

  - Columnas: Retailer | URL | Último precio | Precio objetivo | Diferencia (%) | Estado

  Hoja 2 — Histórico de capturas:

  - Columnas: Fecha | Retailer | Precio capturado | Promo detectada | Tipo promo | Check result

  Hoja 3 — Alertas del período:

  - Columnas: Fecha | Tipo | Severidad | Retailer | Precio detectado | Precio esperado | Estado | Comentario

  Estilos básicos con ExcelJS:

  - Headers en negrita con fondo gris claro
  - Celdas de severidad critical en rojo claro, warning en naranja claro
  - Ancho de columnas ajustado automáticamente al contenido
  - Nombre del archivo: reporte*precios*{productSku}\_{fecha}.xlsx

- CRITERIOS:
  - El archivo Excel se descarga correctamente desde la API
  - Las tres hojas contienen datos reales filtrados por período
  - Los estilos de severidad son visibles en el archivo descargado
- DEPENDENCIAS: PMN-45, PMN-27
- BRANCH: feature/PMN-59-excel-report

---

### TICKET

- KEY: PMN-60
- TITULO: S07 - [BE] Reporte CSV de capturas históricas
- TIPO: Task
- SPRINT: S07 - Reportes, Incidencias y Cierre
- STORY_POINTS: 1
- PRIORIDAD: Low
- ESTADO: Backlog
- DESCRIPCION:
  Agregar a reports.service.ts la generación de reporte CSV plano de capturas.

  Endpoint: GET /api/reports/csv/captures?productId=X&from=YYYY-MM-DD&to=YYYY-MM-DD

  Contenido: todas las PriceCapture del período como CSV con headers.
  Columnas: capturedAt, retailerName, url, currentPrice, struckPrice, promoText, promoType, discountPct, checkResult, stock

  Usar la librería csv-stringify ya instalada.
  Content-Type: text/csv
  Content-Disposition: attachment; filename="capturas\_{fecha}.csv"

- CRITERIOS:
  - El archivo CSV se descarga con el Content-Disposition correcto
  - Los datos están correctamente escapados para CSV (comillas en strings)
  - El archivo se puede abrir en Excel sin problemas de encoding (UTF-8 BOM)
- DEPENDENCIAS: PMN-59
- BRANCH: feature/PMN-60-csv-report

---

### TICKET

- KEY: PMN-61
- TITULO: S07 - [FE] Botones de exportación Excel y CSV en frontend
- TIPO: Task
- SPRINT: S07 - Reportes, Incidencias y Cierre
- STORY_POINTS: 2
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Agregar botones de exportación en las vistas de Detalle de Producto y Alertas.

  En /products/:id:

  - Botón "Exportar Excel" → llama a GET /api/reports/excel?productId={id}&from={from}&to={to}
  - El selector de período del gráfico debe usarse como filtro de fecha para el reporte

  En /alerts:

  - Botón "Exportar Excel" → llama a GET /api/reports/excel con los filtros activos de la tabla

  Comportamiento de descarga:

  - Crear un link temporal con la URL del endpoint y disparar el click programáticamente
  - Nombre del archivo descriptivo: reporte_precios_YYYY-MM-DD.xlsx
  - Mostrar spinner en el botón durante la descarga
  - Toast de error si el endpoint falla

- CRITERIOS:
  - El archivo se descarga automáticamente al hacer click
  - El botón muestra loading durante la descarga
  - Los filtros activos en la vista se aplican al reporte descargado
- DEPENDENCIAS: PMN-59, PMN-55, PMN-54
- BRANCH: feature/PMN-61-fe-export-buttons

---

### TICKET

- KEY: PMN-62
- TITULO: S07 - [BE] Endpoint de estadísticas de incidencias (/alerts/stats)
- TIPO: Task
- SPRINT: S07 - Reportes, Incidencias y Cierre
- STORY_POINTS: 2
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Agregar endpoint de estadísticas a alerts.controller.ts.

  Endpoint: GET /api/alerts/stats?from=YYYY-MM-DD&to=YYYY-MM-DD

  Respuesta:

  ```json
  {
    "total": 47,
    "bySeverity": { "critical": 12, "warning": 30, "info": 5 },
    "byStatus": { "open": 8, "in_review": 3, "resolved": 34, "dismissed": 2 },
    "avgResolutionHours": 4.2,
    "topRetailersByAlerts": [
      { "retailerName": "MercadoLibre", "count": 15 },
      { "retailerName": "Coto", "count": 12 }
    ]
  }
  ```

  avgResolutionHours: promedio de horas entre createdAt y resolvedAt para alertas resueltas en el período.

- CRITERIOS:
  - Los conteos son precisos respecto a los datos reales en DB
  - avgResolutionHours solo incluye alertas con resolvedAt != null
  - El filtro de fechas (from/to) se aplica correctamente
- DEPENDENCIAS: PMN-48
- BRANCH: feature/PMN-62-alerts-stats

---

### TICKET

- KEY: PMN-63
- TITULO: S07 - [INFRA] Docker Compose optimizado para demo
- TIPO: Task
- SPRINT: S07 - Reportes, Incidencias y Cierre
- STORY_POINTS: 2
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Optimizar docker-compose.yml para que la demo completa levante con un solo comando.

  Cambios necesarios:

  - Backend: correr en modo producción (npm run build && npm run start:prod)
  - Frontend: buildar y servir con nginx o vite preview
  - Agregar healthchecks a todos los servicios
  - El backend debe esperar a que postgres y redis estén healthy antes de iniciar (depends_on con condition: service_healthy)
  - Documentar en README el comando exacto para la demo: docker compose up --build -d

  Verificar que la secuencia completa funcione en una máquina limpia:

  1. docker compose up --build -d
  2. npx prisma migrate deploy (no dev)
  3. npx prisma db seed
     → Sistema listo para demo

- CRITERIOS:
  - docker compose up --build -d levanta todos los servicios en orden correcto
  - El backend no arranca hasta que postgres y redis estén saludables
  - El frontend sirve el build de producción (no el servidor de desarrollo)
  - La secuencia completa funciona desde cero en otra máquina del equipo
- DEPENDENCIAS: PMN-7
- BRANCH: feature/PMN-63-docker-demo

---

### TICKET

- KEY: PMN-64
- TITULO: S07 - [BE] Seed completo de demo (30 días de capturas + alertas variadas)
- TIPO: Task
- SPRINT: S07 - Reportes, Incidencias y Cierre
- STORY_POINTS: 3
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Expandir backend/prisma/seed.ts para incluir datos históricos realistas para la demo.

  Datos a generar:

  - Usuario admin + 1 usuario viewer (ya existe, verificar)
  - 1 producto Nestlé (ya existe, verificar)
  - 5-6 URLs de retailers argentinos (ya existe, verificar)
  - 3 reglas activas: no_promo (critical), min_price (warning), max_price (warning)

  NUEVO — Datos históricos:

  - 30 días de PriceCapture por cada URL (1 captura por día = ~180 capturas totales)
  - Precios con variación realista: precio base ± variaciones aleatorias del 0-8%
  - Incluir 5-8 capturas con promo detectada distribuidas en distintos retailers y fechas
  - Incluir 3-4 capturas con checkResult: 'error' para simular fallas

  NUEVO — Alertas de demo:

  - 10-15 alertas en distintos estados: 3 open, 2 in_review, 8 resolved, 2 dismissed
  - Alertas con distintas severidades: 4 critical, 6 warning, 3 info
  - Las alertas resolved deben tener resolvedAt seteado y un resolutionComment

- CRITERIOS:
  - npx prisma db seed ejecuta sin errores y en menos de 60 segundos
  - El gráfico de evolución del frontend muestra 30 días de datos al cargar
  - Las alertas de demo aparecen en la vista de alertas con distintos estados
  - Idempotente (ejecutar dos veces no duplica datos)
- DEPENDENCIAS: PMN-30, PMN-45
- BRANCH: feature/PMN-64-seed-demo

---

### TICKET

- KEY: PMN-65
- TITULO: S07 - [INFRA] GitHub Actions — CI pipeline (lint + build backend + build frontend)
- TIPO: Task
- SPRINT: S07 - Reportes, Incidencias y Cierre
- STORY_POINTS: 2
- PRIORIDAD: Medium
- ESTADO: Backlog
- DESCRIPCION:
  Crear .github/workflows/ci.yml con el pipeline de integración continua.

  Triggers: push a master y pull_requests hacia master

  Jobs en orden:

  1. install: npm ci en backend/ y frontend/
  2. lint: npm run lint en backend/ y frontend/ (configurar ESLint si no está)
  3. build-backend: npm run build en backend/
  4. build-frontend: npm run build en frontend/

  Variables de entorno necesarias en el job de build-backend:

  - JWT_SECRET: configurar como secret del repositorio en GitHub (Settings → Secrets)
  - DATABASE_URL: usar una URL de placeholder (no necesita conectar a DB real para el build)

  Notificación: el pipeline debe pasar en verde antes de hacer merge a master.

- CRITERIOS:
  - El workflow se ejecuta automáticamente en cada push a master
  - El workflow se ejecuta en pull requests hacia master
  - Un build fallido bloquea el merge del PR
  - El pipeline pasa en verde con el código actual del repo
- DEPENDENCIAS: PMN-6
- BRANCH: feature/PMN-65-github-actions

---

### TICKET

- KEY: PMN-66
- TITULO: S07 - [QA] Prueba end-to-end del flujo completo para demo final
- TIPO: Task
- SPRINT: S07 - Reportes, Incidencias y Cierre
- STORY_POINTS: 2
- PRIORIDAD: High
- ESTADO: Backlog
- DESCRIPCION:
  Verificar el flujo completo del sistema de punta a punta en el entorno de demo (Docker Compose + seed completo).

  Flujo a recorrer:

  1. Setup: docker compose up + migrate + seed en máquina limpia
  2. Login: acceder con admin@precio-monitor.com / Admin1234!
  3. Dashboard: verificar tarjetas de resumen con datos reales
  4. Crear producto: crear un nuevo producto con SKU y precio objetivo
  5. Agregar URL: agregar una URL de MercadoLibre al producto creado
  6. Ejecutar scraping: ir a /config → "Ejecutar ahora" → verificar captura en dashboard
  7. Ver alerta: si el precio capturado tiene desvío, verificar alerta en /alerts
  8. Resolver alerta: cambiar status de una alerta a 'resolved' con comentario
  9. Exportar reporte: descargar Excel desde /products/:id
  10. Verificar gráfico: el gráfico de evolución muestra 30 días de datos del seed

  Documentar resultado de cada paso con screenshot en comentarios del ticket.

- CRITERIOS:
  - Los 10 pasos del flujo se completan sin errores bloqueantes
  - Los datos son coherentes entre el dashboard, el detalle de producto y las alertas
  - El Excel descargado contiene datos correctos en las 3 hojas
  - La demo puede presentarse sin intervención técnica adicional
- DEPENDENCIAS: PMN-63, PMN-64, PMN-65, PMN-61
- BRANCH: ninguno (tarea de QA)
