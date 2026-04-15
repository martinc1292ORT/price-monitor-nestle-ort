# Reglas de Negocio — Motor de Compliance

> **Instrucción para Claude Code:**
> Este documento es la referencia completa para implementar el `RulesEngineService` (Sprint 5) y el `PromoDetector` (Sprint 3).
> Es un complemento técnico del `ANALISIS_FUNCIONAL.md`.

---

## 1. Principio General

El motor de reglas recibe una captura (`PriceCapture`) junto con el producto (`Product`) y sus reglas activas (`MonitoringRule[]`), y devuelve una lista de alertas a crear. **No tiene acceso a la base de datos**: es lógica pura entrada/salida, sin efectos secundarios.

```typescript
evaluate(
  capture: PriceCapture,
  product: Product,
  rules: MonitoringRule[]
): AlertInput[]
```

---

## 2. Reglas de Precio

### 2.1 `exact_price` — Precio exacto

El precio debe coincidir con el `targetPrice` del producto dentro de la tolerancia permitida.

**Fórmula:**
```
desvio_porcentual = |precio_capturado - targetPrice| / targetPrice * 100
alerta si: desvio_porcentual > tolerance
```

**Ejemplo:**
- targetPrice = 1000
- tolerance = 2.5 (%)
- Rango aceptable: [975, 1025]
- Precio capturado = 950 → **ALERTA** (desvío del 5%)
- Precio capturado = 1020 → OK (desvío del 2%, dentro de tolerancia)

**Tipo de alerta generada:**
- Si precio < targetPrice → `price_below`
- Si precio > targetPrice → `price_above`

---

### 2.2 `min_price` — Precio mínimo

El precio no puede bajar de un valor mínimo absoluto.

```
alerta si: precio_capturado < minPrice
tipo: price_below
```

---

### 2.3 `max_price` — Precio máximo

El precio no puede superar un valor máximo absoluto.

```
alerta si: precio_capturado > maxPrice
tipo: price_above
```

---

### 2.4 `range` — Rango permitido

Combina mínimo y máximo.

```
alerta si: precio_capturado < minPrice  →  tipo: price_below
alerta si: precio_capturado > maxPrice  →  tipo: price_above
```

---

## 3. Regla de Promociones (`no_promo`)

Esta es la regla más importante para el cliente. Un producto Nestlé **no debe tener ningún tipo de promoción visible**.

**Condiciones que disparan alerta:**

| Condición | Tipo de alerta |
|---|---|
| `struckPrice != null` | `struck_price` |
| `promoText != null && promoText != ''` | `promo_detected` |
| `hasPromo == true` (del PromoDetector) | `promo_detected` |
| `discountPct != null` | `promo_detected` |

**Severidad:**
- La regla `no_promo` siempre genera alertas `critical`.

---

## 4. Escalado de Severidad

Independientemente de la severidad base configurada en la regla, la severidad escala a `critical` si:

```
discountPct > rule.maxDiscountPct
```

**Ejemplo:**
- Regla con severidad `warning` y `maxDiscountPct = 10`
- Captura con `discountPct = 25`
- Resultado: la alerta se genera con severidad `critical`

---

## 5. Señales de Promoción — Referencia para PromoDetector

### 5.1 Precio tachado

Buscar elementos que contengan un precio tachado. Indicadores:

**CSS:**
- `text-decoration: line-through`
- `text-decoration-line: line-through`

**Clases CSS comunes (no exhaustivo):**
```
.price-before
.original-price
.precio-anterior
.tachado
.price-was
.was-price
.old-price
.precio-original
.andes-money-amount--previous   (MercadoLibre)
.ui-pdp-price__original-value   (MercadoLibre)
```

**Si se encuentra precio tachado:**
- `struckPrice` = valor del precio tachado (parsear como número)
- Calcular `discountPct = (struckPrice - currentPrice) / struckPrice * 100`

---

### 5.2 Texto promocional

Buscar en el contenido textual visible de la página. Keywords (case-insensitive):

```
oferta
descuento
promo
promoción
cyber
cybermonday
hotweek
% off
%off
2x1
dos por uno
cuotas sin interés
cuotas sin interes
sin interés
sin interes
ahorrá
ahorras
precio especial
liquidación
liquidacion
sale
flash sale
precio outlet
black friday
```

**Dónde buscar:**
- Texto visible cercano al precio (mismo contenedor o padre directo)
- Badges: `.badge`, `.tag`, `.label`, `.pill`
- Banners sobre la imagen del producto
- Elementos con clases: `.promotion`, `.discount`, `.offer`, `.promo`

---

### 5.3 Clasificación de tipo de promoción

| Señal detectada | promoType |
|---|---|
| Descuento porcentual ("30% off") | `discount` |
| "2x1", "dos por uno" | `2x1` |
| "cuotas sin interés", "X cuotas" | `installments` |
| Precio diferenciado por tarjeta o medio de pago | `payment_method` |
| Cualquier otra señal de promo | `other` |

---

### 5.4 Precios por medio de pago (casos específicos por retailer)

**DIA:**
- El precio con "tarjeta DIA" o "Club DIA" es más bajo que el precio base.
- Tratar como: `promoType: 'payment_method'`
- El `currentPrice` debe ser el precio **sin** tarjeta.

**Carrefour / Maison:**
- Precio con "tarjeta Carrefour" o "Mi Carrefour".
- Tratar como: `promoType: 'payment_method'`

**MercadoPago (en MercadoLibre):**
- Descuentos por pagar con MercadoPago → `promoType: 'payment_method'`

**Criterio general:** Si hay dos precios visibles donde uno requiere un medio de pago específico, el `currentPrice` es el precio base (sin requisito de tarjeta), y la diferencia se registra como `promoType: 'payment_method'`.

---

## 6. Manejo de Casos Especiales

### 6.1 Precio no encontrado

Si `currentPrice == null`:
- `checkResult = 'error'`
- No evaluar reglas de precio (no hay dato)
- No generar alertas de precio
- Actualizar `RetailerUrl.status = 'error'`
- Generar alerta de tipo `scraping_error` con severidad `warning`

### 6.2 Producto no encontrado (404 o página vacía)

Si la URL devuelve error HTTP o no existe:
- `checkResult = 'not_found'`
- Actualizar `RetailerUrl.status = 'not_found'`
- Generar alerta de tipo `not_found` con severidad `critical`

### 6.3 Precio igual a cero

Un precio de `0` debe tratarse como error de captura, no como precio válido.
- `checkResult = 'error'`
- No evaluar reglas de precio

### 6.4 Precio capturado igual al objetivo

Si el precio coincide exactamente y no hay señales de promo:
- `checkResult = 'ok'`
- No generar alertas

---

## 7. Deduplicación de Alertas

El `AlertsService` (no el motor de reglas) aplica deduplicación antes de persistir:

```
si existe alerta con:
  - mismo type
  - mismo retailerUrlId
  - status IN ('open', 'in_review')
→ NO crear nueva alerta
```

**Cuándo SÍ crear una nueva alerta del mismo tipo:**
- La alerta anterior fue marcada como `resolved` o `dismissed`
- Esto permite que el mismo problema reincida y genere una nueva incidencia

---

## 8. Prioridad de Evaluación de Reglas

Si un producto tiene múltiples reglas activas, se evalúan todas. Se pueden generar múltiples alertas en una misma captura (ej: precio bajo el mínimo Y promo detectada).

No hay exclusión entre reglas. Cada regla activa se evalúa de forma independiente.

---

## 9. Resultado esperado del `checkResult`

| Valor | Cuándo |
|---|---|
| `ok` | Precio dentro del rango, sin promos |
| `deviation` | Precio fuera del rango permitido (sin promo) |
| `promo` | Se detectó cualquier señal de promoción |
| `error` | Fallo técnico en el scraping o precio no encontrado |
| `not_found` | La URL no responde o el producto fue removido |

Si en una misma captura hay tanto desvío de precio como promo, el `checkResult` es `promo` (más crítico).

---

## 10. Interfaz TypeScript de Referencia

```typescript
// Input del motor de reglas
interface RuleEvaluationInput {
  capture: {
    currentPrice: number | null;
    struckPrice: number | null;
    promoText: string | null;
    promoType: string | null;
    discountPct: number | null;
    checkResult: string;
  };
  product: {
    targetPrice: number;
    tolerance: number | null; // porcentaje, ej: 2.5
  };
  rules: Array<{
    id: number;
    ruleType: 'exact_price' | 'min_price' | 'max_price' | 'range' | 'no_promo';
    minPrice: number | null;
    maxPrice: number | null;
    allowPromos: boolean;
    maxDiscountPct: number | null;
    severity: 'info' | 'warning' | 'critical';
    isActive: boolean;
  }>;
}

// Output del motor de reglas
interface AlertInput {
  type: 'price_below' | 'price_above' | 'promo_detected' | 'struck_price' | 'not_found' | 'scraping_error';
  severity: 'info' | 'warning' | 'critical';
  detectedValue: number | null;
  expectedValue: number | null;
  description: string;
}

// Output del PromoDetector
interface PromoResult {
  hasPromo: boolean;
  struckPrice: number | null;
  promoText: string | null;
  promoType: 'discount' | '2x1' | 'installments' | 'payment_method' | 'other' | null;
  discountPct: number | null;
}
```

---
