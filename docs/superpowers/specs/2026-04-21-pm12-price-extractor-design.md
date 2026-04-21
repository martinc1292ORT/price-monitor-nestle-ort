# PM-12 — PriceExtractor: estrategias de extracción

**Fecha:** 2026-04-21
**Branch:** feature/pm-12-price-extractor-strategies
**Estado:** Aprobado — listo para implementar

---

## Contexto

El PM-11 dejó un MVP funcional del módulo de scraping. `price.extractor.ts` ya implementa
las tres estrategias básicas (JSON-LD, Meta, CSS) y está integrado en `ScrapingService`.

PM-12 refina ese MVP:

- Agrega una 4ª estrategia semántica (Microdata / schema.org)
- Elimina la duplicación de `parsePrice` entre los dos extractores
- Enriquece `rawData` para trazabilidad real
- Robustece JSON-LD para manejar variantes de estructura (`Offer`, `AggregateOffer`, `@graph`)
- Robustece Microdata para manejar múltiples nodos `[itemprop="price"]` en la misma página

---

## Archivos involucrados

```
backend/src/scraping/
  price-parser.util.ts      ← NUEVO
  price.extractor.ts        ← MODIFICADO
  promo.extractor.ts        ← MODIFICADO (solo elimina su parsePrice privado)
```

La estructura flat de `scraping/` se preserva. No se mueven archivos.

---

## price-parser.util.ts

Función pura exportada, sin dependencias NestJS, testeable de forma aislada.

```ts
export function parsePrice(text: string): number | null
```

**Reglas de normalización:**
1. Trim del string de entrada; retornar `null` si vacío
2. Eliminar todo excepto dígitos, puntos y comas: `/[^\d.,]/g`
3. Determinar el separador decimal por **posición del último separador**:
   - `lastIndexOf(',') > lastIndexOf('.')` → decimal es coma (EU): eliminar puntos, reemplazar coma por punto
     - `"1.299,99"` → `"1299.99"`
   - `lastIndexOf('.') > lastIndexOf(',')` → decimal es punto (US): eliminar comas
     - `"1,299.99"` → `"1299.99"`
   - Solo coma, sin punto → decimal es coma: reemplazar coma por punto
     - `"1299,99"` → `"1299.99"`
   - Solo punto, sin coma → decimal es punto: sin transformación
     - `"1299.99"` → `"1299.99"`
   - Sin separadores → dígitos puros: sin transformación
4. `parseFloat` del resultado
5. Retornar `null` si `isNaN` o `<= 0`

> **Edge case documentado:** `"1.299"` (sin coma) se resuelve como `1.299` (decimal),
> no como `1299` (miles). En la práctica los precios argentinos con miles siempre
> usan coma decimal (`"1.299,00"`), por lo que este caso es raro en los sites monitoreados.

---

## price.extractor.ts

### Interfaz pública (sin cambios)

```ts
export interface PriceExtractionResult {
  currentPrice: number | null;
  detectedName: string | null;
  rawData: Record<string, unknown>;
}

@Injectable()
export class PriceExtractor {
  async extract(page: Page): Promise<PriceExtractionResult>
}
```

### rawData enriquecido

Cuando una estrategia tiene éxito, `rawData` incluye:
```ts
{
  strategy: 'json-ld' | 'meta' | 'microdata' | 'css' | 'none',
  rawValue: string,      // valor tal como fue encontrado en el DOM
  source: string,        // descriptor preciso de dónde vino
}
```

Ejemplos de `source`:
- `"jsonld.offers.price"`, `"jsonld.offers.lowPrice"`, `"jsonld.direct.price"`
- `"meta.og:price:amount"`, `"meta.product:price:amount"`
- `"microdata.[itemprop=price].content"`, `"microdata.[itemprop=price].textContent"`
- `"css.[data-price]"`, `"css.[itemprop=\"price\"]"`, `"css..price"`

Cuando ninguna estrategia funciona:
```ts
{ strategy: 'none' }
```

### Cadena de estrategias

```
extract(page)
  1. fromJsonLd(page)
  2. fromMeta(page)
  3. fromMicrodata(page)
  4. fromCss(page)
```

Cada estrategia devuelve `null` (no lanza). Si devuelve un resultado con `currentPrice !== null`, se retorna inmediatamente.

### fromJsonLd — variantes soportadas

Iterar todos los `<script type="application/ld+json">` del documento.
Parsear como JSON; si falla, continuar al siguiente script.

Para cada entry (o elemento de `@graph`), buscar en este orden:

| `@type` | Campo de precio |
|---|---|
| `Product` | `offers.price`, `offers.lowPrice` (si `offers` es array, tomar el primero) |
| `Offer` | `price`, `lowPrice` |
| `AggregateOffer` | `lowPrice`, `price` |

Si se encuentra precio, retornar junto al `name` del entry si está disponible.
`source` para entradas `Product.offers`: `"jsonld.offers.price"` / `"jsonld.offers.lowPrice"`.
`source` para entradas directas (`Offer` / `AggregateOffer`): `"jsonld.direct.price"` / `"jsonld.direct.lowPrice"`.

### fromMeta — tags soportados

Buscar en orden:
1. `meta[property="og:price:amount"]` o `meta[name="og:price:amount"]`
2. `meta[property="product:price:amount"]` o `meta[name="product:price:amount"]`

Nombre desde `meta[property="og:title"]` o `meta[name="og:title"]`.

### fromMicrodata — múltiples nodos

```ts
const allNodes = await page.$$eval(
  '[itemprop="price"]',
  (els) => els.map(el => ({
    content: el.getAttribute('content'),
    text: el.textContent,
  }))
)
```

- Recoger todos los nodos. Loguear `candidateCount` en `rawData`.
- Iterar: preferir `content` sobre `textContent`. Tomar el primer valor parseable (> 0).
- Si la página trae múltiples precios (ej: precio regular + precio promo), el primero
  parseable en el DOM suele ser el precio principal — comportamiento aceptable para MVP.

### fromCss — sin cambios funcionales

Mismos selectores que en el MVP. Ahora reporta el selector que matcheó en `source`.

```ts
const CSS_PRICE_SELECTORS = [
  '.price', '[data-price]', '.precio', '#price',
  '.product-price', '[itemprop="price"]',
];
```

> Nota: `[itemprop="price"]` aparece también en CSS_PRICE_SELECTORS como último recurso,
> pero `fromMicrodata` ya lo evalúa de forma semántica antes. En la práctica, si
> `fromMicrodata` tuvo éxito, `fromCss` nunca se ejecuta para ese nodo.

---

## promo.extractor.ts

Único cambio: eliminar `private parsePrice()` e importar `parsePrice` de `price-parser.util.ts`.
Sin cambios funcionales.

---

## Manejo de errores

- Cada estrategia usa `.catch()` — un fallo no interrumpe las siguientes.
- `parsePrice` nunca lanza.
- Si todas fallan: `logger.warn('No price found for page: ...')`.
- Fallos individuales de estrategia: `logger.debug('...')`.

---

## Testing sugerido (no implementado en este ticket)

### price-parser.util.ts (unitario puro)

| Input | Expected |
|---|---|
| Input | Expected | Motivo |
|---|---|---|
| `'$1.299,99'` | `1299.99` | EU: último separador es coma |
| `'1,299.99'` | `1299.99` | US: último separador es punto |
| `'1299,99'` | `1299.99` | solo coma → decimal |
| `'1299.99'` | `1299.99` | solo punto → decimal |
| `'1.299'` | `1.299` | edge case documentado |
| `'  $ 850 '` | `850` | trim + símbolo |
| `''` | `null` | vacío |
| `'0'` | `null` | valor <= 0 |
| `'-50'` | `null` | valor <= 0 |
| `'sin precio'` | `null` | sin dígitos |

### fromJsonLd

- Fixture con `@type: Product` con `offers.price`
- Fixture con `@type: Offer` directo
- Fixture con `@type: AggregateOffer` con `lowPrice`
- Fixture con `@graph` que contiene un `Product`
- Fixture con `offers` como array (tomar el primero)
- JSON malformado → continúa sin lanzar

### fromMeta

- `og:price:amount` presente
- Solo `product:price:amount` presente
- Ninguno presente → `null`

### fromMicrodata

- 0 nodos → `null`
- 1 nodo con `content="1299.99"` → `1299.99`
- 1 nodo sin `content`, con `textContent="$ 1.299"` → `1299`
- 3 nodos, primero con valor inválido, segundo válido → tomar segundo

### fromCss

- Selector que matchea con `data-price`
- Selector que matchea con `textContent` con símbolo de moneda
- Ningún selector matchea → `null`

### Integración (con mocks de `Page`)

- Estrategia 1 falla → continúa a estrategia 2
- `rawData.strategy` refleja qué estrategia funcionó
- `rawData.source` refleja exactamente de dónde vino el valor

---

## Supuestos y edge cases

- **Múltiples precios en Microdata**: se toma el primero parseable. En retailers con precio
  regular + precio con tarjeta, esto puede capturar el precio incorrecto. Aceptable para MVP;
  la Fase B (Stagehand) lo resolverá con contexto semántico.
- **JSON-LD con `@graph` anidado**: se itera un nivel. Grafos profundamente anidados quedan
  para futura iteración.
- **Separador de miles ambiguo** (`1.200` en Argentina puede ser 1200 o 1.2):
  `parsePrice` resuelve a favor del formato europeo si hay coma en el string;
  si no hay coma, trata el punto como separador decimal → `1.200` = `1.2`.
  En la práctica, los precios argentinos siempre usan coma decimal, por lo que
  precios sin decimales explícitos (`1.200`) son raros en los sites monitoreados.
- **Interfaz pública**: `PriceExtractionResult` no cambia. `ScrapingService` y `ScrapingModule`
  no requieren modificación.
