# Análisis Funcional — Sistema de Monitoreo de Precios en E-Commerce

> **Instrucción para Claude Code:**
> Este documento describe QUÉ debe hacer el sistema y POR QUÉ.
> Para ver CÓMO implementarlo (stack, sprints, schema), leer `PLAN_COMPLETO_PRICE_MONITOR_v2.md`.
> Consultar este documento ante cualquier duda de comportamiento esperado, reglas de negocio o requisitos de UX.

---

## Índice

- [Contexto y Problema de Negocio](#contexto)
- [Actores y Roles](#actores)
- [Módulos Funcionales](#modulos)
  - [M1 — Gestión de Productos](#m1)
  - [M2 — Gestión de Retailers y URLs](#m2)
  - [M3 — Configuración del Monitoreo](#m3)
  - [M4 — Captura de Precios](#m4)
  - [M5 — Motor de Reglas y Compliance](#m5)
  - [M6 — Sistema de Alertas](#m6)
  - [M7 — Dashboard y Visualización](#m7)
  - [M8 — Histórico de Precios](#m8)
  - [M9 — Reportes y Exportación](#m9)
  - [M10 — Gestión de Incidencias](#m10)
- [Requisitos No Funcionales](#nonfunctional)
- [Métricas de Éxito](#metricas)
- [Supuestos y Dependencias](#supuestos)
- [Limitaciones del MVP](#limitaciones)

---

## Contexto y Problema de Negocio {#contexto}

**Cliente:** Nestlé Argentina

**Problema actual:**
El seguimiento de precios de productos Nestlé en retailers de e-commerce se hace de forma manual, dispersa y reactiva. Los analistas comerciales visitan manualmente sitios web para verificar precios, lo que resulta en:
- Detección tardía de descuentos o promociones no autorizadas
- Imposibilidad de auditar cuándo ocurrió una anomalía y cuánto duró
- Sin trazabilidad histórica del comportamiento de precios por retailer

**Por qué importa:**
Nestlé define un precio de venta sugerido (PVS) para sus productos. Cuando un retailer publica el producto con descuento, precio tachado o cualquier tipo de promoción no autorizada, esto afecta la percepción de marca y puede generar conflictos con otros canales. El incumplimiento del PVS debe detectarse, documentarse y escalarse.

**Solución esperada:**
Una plataforma que automatice el monitoreo, detecte desvíos en tiempo real, genere evidencia auditable y permita al equipo comercial gestionar incidencias desde un panel centralizado.

---

## Actores y Roles {#actores}

### Admin
- Gestiona productos, URLs, reglas y configuración del sistema
- Puede asignar alertas, cambiar estados y gestionar usuarios
- Acceso completo a todas las funciones

### Viewer
- Consulta el dashboard, alertas e histórico
- Puede exportar reportes
- No puede crear ni modificar configuración

### Sistema (automatizado)
- Ejecuta el scraping según la frecuencia configurada
- Evalúa reglas y genera alertas
- Envía notificaciones por email / Teams

---

## Módulos Funcionales {#modulos}

---

### M1 — Gestión de Productos {#m1}

**Propósito:** Definir qué productos se monitorean y bajo qué condiciones de precio son aceptables.

**Datos del producto:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| name | string | Sí | Nombre comercial del producto |
| sku | string | Sí | Identificador único interno. Inmutable una vez creado |
| brand | string | No | Marca (ej: Nescafé, Milo) |
| category | string | No | Categoría (ej: Bebidas, Lácteos) |
| targetPrice | decimal | Sí | Precio objetivo o PVS. Base para comparar capturas |
| tolerance | decimal (%) | No | Margen de tolerancia sobre el targetPrice. Default: 0. Si es 2.5, significa ±2.5% es aceptable |
| status | enum | Sí | `active` \| `inactive`. Solo se monitorean los activos |
| validFrom | date | No | Desde cuándo aplica el monitoreo. Si es nulo, aplica siempre |
| validTo | date | No | Hasta cuándo aplica. Si es nulo, aplica indefinidamente |

**Reglas de negocio:**
- El SKU es único en el sistema. No se puede duplicar.
- Un producto desactivado (`inactive`) no genera nuevas capturas ni alertas.
- El `targetPrice` puede actualizarse. Los chequeos posteriores usan el precio vigente al momento del chequeo.
- No se borran productos: se desactivan. Esto preserva el histórico.
- Al crear un producto, se debe crear automáticamente una regla por defecto: tipo `no_promo`, severidad `critical`.

**Alcance MVP:** Un producto principal. El sistema debe soportar múltiples desde el schema.

---

### M2 — Gestión de Retailers y URLs {#m2}

**Propósito:** Registrar dónde se vende cada producto en e-commerce para poder monitorearlo.

**Datos de cada URL:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| retailerName | string | Sí | Nombre del retailer (ej: MercadoLibre, Coto, DIA) |
| url | string | Sí | URL exacta del producto en el sitio del retailer |
| internalCode | string | No | Código interno del retailer si aplica |
| country | string | No | País/mercado. Default: AR |
| detectedName | string | No | Nombre que detectó el scraper en la última captura |
| status | enum | Sí | `active` \| `inactive` \| `error` \| `not_found` |
| notes | string | No | Observaciones manuales |

**Reglas de negocio:**
- Una URL solo puede estar asociada a un producto.
- El sistema debe actualizar el `status` automáticamente:
  - Si la URL devuelve 404 o similar → `not_found`
  - Si el scraping falla repetidamente (3+ intentos) → `error`
  - Si el producto fue removido del sitio → `not_found`
- Las URLs con status `inactive`, `error` o `not_found` no generan jobs de scraping nuevos, pero conservan su historial.
- Un admin puede reactivar una URL `error` o `not_found` manualmente.

**Retailers objetivo (Argentina):**
- MercadoLibre
- Coto
- DIA
- Carrefour / Maison
- Walmart / Changomas

---

### M3 — Configuración del Monitoreo {#m3}

**Propósito:** Controlar cuándo y con qué frecuencia se ejecuta el scraping.

**Configuración global (`MonitoringConfig`):**

| Campo | Descripción |
|---|---|
| frequency | Frecuencia de chequeo: `1h`, `3h`, `6h`, `12h`, `24h` |
| isRunning | Si el scheduler está activo o pausado |

**Comportamiento esperado:**
- Cambiar la frecuencia debe tener efecto inmediato, sin reiniciar el servidor.
- Si `isRunning = false`, no se encolan nuevos jobs automáticos. Los manuales sí funcionan.
- Un admin puede forzar un scraping manual de una URL específica o de todas las URLs activas.
- La frecuencia aplica globalmente. No hay frecuencias por retailer en el MVP.

**Frecuencias disponibles y su equivalente:**

| Valor | Cuándo ejecuta |
|---|---|
| `1h` | Cada hora en punto |
| `3h` | Cada 3 horas |
| `6h` | Cada 6 horas |
| `12h` | Cada 12 horas |
| `24h` | Una vez por día a las 8:00 AM |

---

### M4 — Captura de Precios {#m4}

**Propósito:** Extraer de cada URL el precio publicado y cualquier señal de promoción, guardando evidencia auditable.

**Datos a capturar:**

| Campo | Descripción |
|---|---|
| currentPrice | Precio actual publicado |
| struckPrice | Precio tachado (precio "antes de descuento"), si existe |
| promoText | Texto promocional visible en la página (ej: "30% OFF", "Precio especial") |
| promoType | Clasificación: `discount` \| `2x1` \| `installments` \| `payment_method` \| `other` |
| discountPct | Porcentaje de descuento calculado si hay ambos precios |
| stock | Estado de disponibilidad: `available` \| `out_of_stock` \| `unknown` |
| detectedName | Nombre del producto tal como aparece en el retailer |
| screenshotPath | Path relativo al screenshot de la página |
| htmlPath | Path relativo al HTML guardado |
| checkResult | Resultado: `ok` \| `deviation` \| `promo` \| `error` \| `not_found` |

**Evidencia — requerimiento crítico:**
Cada captura debe generar:
- **Screenshot:** Imagen de la página completa al momento de la captura
- **HTML:** Contenido HTML de la página guardado en disco

La evidencia es necesaria para:
- Auditar si una alerta fue un falso positivo
- Reclamar al retailer con prueba concreta
- Demostrar qué se vio exactamente en un momento dado

Los paths se guardan en DB como referencias relativas. Los archivos se organizan por fecha: `evidence/screenshots/YYYY-MM-DD/` y `evidence/html/YYYY-MM-DD/`.

**Señales de promoción a detectar:**

El sistema debe buscar activamente estas señales en cada página:
- Precio tachado (cualquier elemento con `text-decoration: line-through` o clases típicas)
- Texto que contenga: `oferta`, `descuento`, `promo`, `cyber`, `% off`, `2x1`, `cuotas sin interés`, `ahorrá`, `precio especial`, `liquidación`
- Badges o etiquetas con esos textos (`.badge`, `.tag`, `.label`)
- Precios diferenciados por medio de pago (tarjeta Carrefour, tarjeta DIA, etc.) → clasificar como `payment_method`
- Cuotas sin interés → clasificar como `installments`

**Estrategia de extracción (en orden de prioridad):**
1. JSON-LD (`<script type="application/ld+json">` con `@type: Product`)
2. Meta tags Open Graph (`og:price:amount`)
3. Selectores CSS conocidos
4. Fallback: `null` con `checkResult: 'error'`

Siempre loguear qué estrategia fue usada para facilitar debugging.

**Casos especiales por retailer:**
- **MercadoLibre:** JSON-LD completo. Cuidado con variantes de producto (talle/color cambia el precio). Capturar precio de variante por defecto.
- **Coto:** Interceptar la API JSON interna en lugar de parsear HTML. Más estable.
- **DIA:** Precio diferenciado por tarjeta de fidelidad. Capturar precio base; el precio de tarjeta es señal de promo tipo `payment_method`.
- **Carrefour:** Precio base + precio con tarjeta Carrefour. Tratar precio de tarjeta como `payment_method`.

---

### M5 — Motor de Reglas y Compliance {#m5}

**Propósito:** Evaluar cada captura contra las reglas definidas para el producto y determinar si hay desvíos.

**Tipos de regla disponibles:**

| ruleType | Condición que dispara alerta |
|---|---|
| `exact_price` | El precio capturado difiere del `targetPrice` más allá de la `tolerance` |
| `min_price` | El precio capturado es menor que `minPrice` |
| `max_price` | El precio capturado es mayor que `maxPrice` |
| `range` | El precio está fuera del rango `[minPrice, maxPrice]` |
| `no_promo` | Se detectó cualquier señal de promoción (precio tachado, texto promo, etc.) |

**Cálculo de desvío para `exact_price`:**
```
desvio = |precio_capturado - targetPrice| / targetPrice × 100
si desvio > tolerance → alerta
```

**Escalado de severidad:**
- Si `discountPct > maxDiscountPct` configurado → la severidad escala automáticamente a `critical`
- Regla `no_promo` con cualquier señal de promo → siempre `critical`

**Las reglas son parametrizables:**
- Se guardan en DB, no en código
- Pueden crearse múltiples reglas por producto
- Cada regla tiene su propia severidad: `info` \| `warning` \| `critical`
- Las reglas pueden activarse/desactivarse sin eliminarlas

**Regla por defecto al crear producto:**
Automáticamente se crea: `{ ruleType: 'no_promo', allowPromos: false, severity: 'critical', isActive: true }`

---

### M6 — Sistema de Alertas {#m6}

**Propósito:** Notificar al equipo comercial cuando se detecta un desvío o anomalía.

**Tipos de alerta:**

| type | Descripción |
|---|---|
| `price_below` | Precio por debajo del mínimo permitido |
| `price_above` | Precio por encima del máximo permitido |
| `promo_detected` | Se detectó texto o señal promocional |
| `struck_price` | Se detectó precio tachado |
| `not_found` | El producto no fue encontrado en la URL |
| `scraping_error` | Error técnico al intentar capturar |

**Niveles de severidad:**

| Nivel | Color sugerido | Cuándo |
|---|---|---|
| `info` | Azul | Cambio menor, dentro de tolerancia pero destacable |
| `warning` | Amarillo/Naranja | Desvío real pero no crítico |
| `critical` | Rojo | Promoción detectada, desvío grave, producto no encontrado |

**Estados del ciclo de vida de una alerta:**

```
open → in_review → resolved
            ↓
         dismissed
```

| Estado | Descripción |
|---|---|
| `open` | Recién detectada, sin acción |
| `in_review` | Un usuario está investigando |
| `resolved` | Confirmada y resuelta |
| `dismissed` | Descartada (falso positivo u otro motivo) |

**Reglas de deduplicación:**
- Si ya existe una alerta `open` del mismo `type` para el mismo `retailerUrlId`, no crear una nueva.
- Solo se crea una nueva alerta del mismo tipo cuando la anterior fue resuelta o descartada.

**Canales de notificación:**
- Email (Nodemailer): siempre que se genere una alerta `warning` o `critical`
- Microsoft Teams (Webhook): si está configurado
- Panel interno: todas las alertas, sin excepción

**Contenido mínimo del email de alerta:**
- Nombre del producto
- Retailer afectado
- Precio detectado vs precio esperado
- Tipo de alerta y severidad (con color)
- Link a la URL del producto
- Timestamp de detección

---

### M7 — Dashboard y Visualización {#m7}

**Propósito:** Dar visibilidad rápida del estado del mercado al equipo comercial.

**Vista principal (tabla resumen):**

| Columna | Descripción |
|---|---|
| Producto | Nombre del producto |
| Retailer | Nombre del retailer |
| Último precio | Precio de la última captura exitosa |
| Precio objetivo | Target price configurado |
| Diferencia (%) | `(ultimo - objetivo) / objetivo × 100` con signo |
| Estado | Badge de color por estado de compliance |
| Última captura | Timestamp de la última captura |

**Estados y colores del badge:**
- Verde (`ok`): precio dentro del rango, sin promos
- Amarillo (`warning`): desvío menor
- Rojo (`critical`): promo detectada o desvío grave
- Gris (`error`): fallo de scraping
- Negro/Dark (`not_found`): URL no responde o producto no encontrado

**Tarjetas de resumen (KPIs):**
- Total de retailers monitoreados
- Retailers con alerta activa (rojo si > 0)
- Capturas en las últimas 24 horas
- Alertas críticas abiertas

**Filtros disponibles:**
- Por producto
- Por retailer
- Por estado
- Por fecha (desde/hasta)
- Por tipo de alerta
- Por país (futuro)

**Gráfico de evolución de precios:**
- Eje X: tiempo
- Eje Y: precio
- Una línea por retailer (colores distintos)
- Línea de referencia horizontal = precio objetivo
- Filtros de período: últimos 7 días, 30 días, rango custom

---

### M8 — Histórico de Precios {#m8}

**Propósito:** Conservar todas las capturas para análisis retrospectivo y auditoría.

**Qué debe permitir:**
- Ver la evolución del precio de un producto en un retailer a lo largo del tiempo
- Identificar cuándo cambió el precio, cuánto duró la anomalía y cuántas veces ocurrió
- Ver si en una captura específica había promo o no (con acceso a la evidencia)
- Filtrar por producto, retailer y rango de fechas

**Política de retención:**
- No se borran capturas en el MVP.
- Los screenshots y HTML ocupan espacio en disco: en la Fase C se migra a MinIO para gestionar el volumen.

---

### M9 — Reportes y Exportación {#m9}

**Propósito:** Generar reportes para análisis fuera del sistema y seguimiento ejecutivo.

**Reporte Excel (3 hojas):**

1. **Precios actuales:** Retailer | URL | Último precio | Precio objetivo | Diferencia % | Estado
2. **Histórico de capturas:** Fecha | Retailer | Precio capturado | Promo detectada | Resultado del chequeo
3. **Alertas:** Fecha | Tipo | Severidad | Retailer | Precio detectado | Precio esperado | Estado | Comentario

**Estilos del Excel:**
- Headers en negrita
- Filas de alertas coloreadas según severidad (rojo/amarillo/azul)
- Columnas con ancho ajustado al contenido

**Reporte CSV:**
- Capturas planas del período seleccionado
- Para consumo en herramientas externas

**Filtros de exportación:**
- Por producto
- Por rango de fechas (from/to)

**Nombre de archivo sugerido:** `reporte_precios_YYYY-MM-DD.xlsx`

**MVP:** Excel + CSV. PDF y Teams quedan para Etapa 2 (Fase C).

---

### M10 — Gestión de Incidencias {#m10}

**Propósito:** Dar trazabilidad operativa a cada alerta, no solo técnica.

**Flujo de una incidencia:**
1. El sistema detecta un desvío y crea una alerta (`open`)
2. Un analista la ve en el dashboard y la toma (`in_review`)
3. Investiga: revisa el screenshot, verifica en el sitio del retailer
4. Resuelve: contacta al retailer, confirma resolución (`resolved`) o descarta si fue error (`dismissed`)

**Datos de seguimiento:**

| Campo | Descripción |
|---|---|
| status | Estado actual del ciclo de vida |
| assignedUserId | Usuario responsable del seguimiento |
| comment | Observación interna |
| resolutionComment | Qué se hizo para resolverlo |
| resolvedAt | Timestamp de resolución |

**Métricas de incidencias (endpoint `/api/alerts/stats`):**
- Total de alertas en el período
- Breakdown por severidad
- Breakdown por status
- Tiempo promedio de resolución (horas)

---

## Requisitos No Funcionales {#nonfunctional}

### Disponibilidad
- ≥ 99% de uptime en horarios operativos
- El sistema debe recuperarse automáticamente de fallos de scraping (reintentos con backoff)

### Precisión
- ≥ 95% de desvíos reales correctamente detectados
- ≤ 5% de falsos positivos en alertas

### Cobertura de scraping
- ≥ 90% de URLs monitoreadas con capturas exitosas
- ≤ 10% de errores de scraping por ciclo

### Tiempo de respuesta
- Detección de cambios dentro del intervalo configurado
- Alertas generadas en menos de 5 minutos desde la detección
- Endpoints del dashboard con respuesta < 2 segundos

### Seguridad
- Autenticación JWT con refresh tokens
- Rate limiting en endpoint de login (5 intentos/minuto)
- Todos los endpoints protegidos por defecto
- Rutas de admin protegidas por rol
- Validación de inputs en todos los endpoints
- Headers de seguridad (Helmet)

### Robustez del scraping
- Manejo de contenido dinámico (JavaScript renderizado)
- Reintentos ante fallos de red o timeout
- Detección de bloqueos anti-bot
- Tolerancia a cambios menores en el DOM

### Auditabilidad
- Toda alerta debe tener evidencia (screenshot + HTML)
- Los cambios de estado de alertas deben registrarse
- Las capturas históricas no se eliminan

---

## Métricas de Éxito {#metricas}

El proyecto se considera exitoso cuando:

| Métrica | Objetivo |
|---|---|
| Desvíos detectados correctamente | ≥ 95% |
| Falsos positivos | ≤ 5% |
| Tiempo de detección desde publicación | ≤ intervalo configurado |
| URLs con capturas exitosas | ≥ 90% |
| Disponibilidad del sistema | ≥ 99% |
| Tiempo de generación de alerta | < 5 minutos desde detección |
| Adopción por usuarios | ≥ 80% del equipo usa el sistema |
| Reducción de monitoreo manual | ≥ 70% |

---

## Supuestos y Dependencias {#supuestos}

### Supuestos
- Se dispone de URLs válidas y públicamente accesibles de los productos a monitorear
- Los precios en los retailers son visibles sin login (o sin geolocalización específica)
- Se dispone de credenciales SMTP válidas de Nestlé para el envío de emails de alerta
- Se dispone del template de email de Nestlé (paleta de colores institucional)
- La frecuencia de monitoreo inicial es 6 horas (configurable)

### Dependencias externas
- Disponibilidad de los sitios web de retailers (si el sitio está caído, la captura falla)
- Estabilidad del DOM de los retailers (cambios requieren mantenimiento de selectores)
- Servidor SMTP para emails
- Microsoft Teams Webhook (opcional, para notificaciones en Teams)

---

## Limitaciones del MVP {#limitaciones}

Lo que **NO** incluye la versión inicial:

- No hay integración con sistemas corporativos de Nestlé (SAP, BI, etc.)
- No se monitorean precios detrás de login o por geolocalización
- No hay automatización de acciones correctivas (solo detección y alerta)
- No hay análisis predictivo de precios
- No hay soporte multi-país en el scheduler (zona horaria única: Argentina)
- No hay reportes en PDF (se agrega en Fase C de Etapa 2)
- No hay integración con Teams (se agrega en Fase C de Etapa 2)
- No hay almacenamiento en la nube para evidencias (MinIO se agrega en Fase C)
- No hay scraping inteligente con IA (Stagehand se agrega en Fase B de Etapa 2)

---
