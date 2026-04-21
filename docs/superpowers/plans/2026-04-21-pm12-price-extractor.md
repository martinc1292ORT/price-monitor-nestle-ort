# PM-12 PriceExtractor — Estrategias de Extracción — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar el `PriceExtractor` del MVP con una 4ª estrategia semántica (Microdata), eliminar la duplicación de `parsePrice`, enriquecer `rawData` para trazabilidad, y corregir el algoritmo de normalización de precios.

**Architecture:** Tres archivos en `backend/src/scraping/`. Un utility puro `price-parser.util.ts` se extrae del código duplicado entre los dos extractores. `price.extractor.ts` incorpora la cadena completa de 4 estrategias (JSON-LD → Meta → Microdata → CSS) con `rawData` enriquecido. `promo.extractor.ts` solo elimina su copia local de `parsePrice`.

**Tech Stack:** NestJS, TypeScript, Playwright `Page`, Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-04-21-pm12-price-extractor-design.md`

---

## File Map

| Acción | Archivo |
|---|---|
| NUEVO | `backend/src/scraping/price-parser.util.ts` |
| NUEVO | `backend/src/scraping/price-parser.util.spec.ts` |
| MODIFICADO | `backend/src/scraping/price.extractor.ts` |
| NUEVO | `backend/src/scraping/price.extractor.spec.ts` |
| MODIFICADO | `backend/src/scraping/promo.extractor.ts` |

`scraping.service.ts`, `scraping.module.ts`, y `scraping.controller.ts` **no requieren cambios** — la interfaz pública de `PriceExtractor` no cambia.

---

## Task 1: Crear la rama de trabajo

- [ ] **Step 1: Crear rama**

```bash
git checkout -b feature/pm-12-price-extractor-strategies
```

Expected: Branch created and checked out.

---

## Task 2: `price-parser.util.ts` — utilidad compartida de normalización

**Files:**
- Create: `backend/src/scraping/price-parser.util.ts`
- Create: `backend/src/scraping/price-parser.util.spec.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/src/scraping/price-parser.util.spec.ts`:

```typescript
import { parsePrice } from './price-parser.util';

describe('parsePrice', () => {
  it.each<[string, number | null]>([
    ['$1.299,99', 1299.99],   // EU: último separador es coma
    ['1,299.99', 1299.99],    // US: último separador es punto
    ['1299,99', 1299.99],     // solo coma → decimal
    ['1299.99', 1299.99],     // solo punto → decimal
    ['  $ 850 ', 850],        // trim + símbolo
    ['850', 850],             // dígitos puros
  ])('parsea "%s" → %s', (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each<[string]>([
    [''],
    ['   '],
    ['0'],
    ['-50'],
    ['sin precio'],
    ['abc'],
  ])('retorna null para "%s"', (input) => {
    expect(parsePrice(input)).toBeNull();
  });

  it('edge case: "1.299" sin coma se resuelve como decimal 1.299', () => {
    expect(parsePrice('1.299')).toBe(1.299);
  });
});
```

- [ ] **Step 2: Correr el test — verificar que falla**

```bash
cd backend && npx jest src/scraping/price-parser.util.spec.ts --no-coverage
```

Expected: `FAIL` — `Cannot find module './price-parser.util'`.

- [ ] **Step 3: Implementar `price-parser.util.ts`**

Crear `backend/src/scraping/price-parser.util.ts`:

```typescript
export function parsePrice(text: string): number | null {
  if (!text || !text.trim()) return null;

  const cleaned = text.trim().replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;

  if (lastComma > lastDot) {
    // European format: last separator is comma → decimal
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // American format: last separator is dot → decimal
    normalized = cleaned.replace(/,/g, '');
  } else {
    // No separators
    normalized = cleaned;
  }

  const value = parseFloat(normalized);
  return isNaN(value) || value <= 0 ? null : value;
}
```

- [ ] **Step 4: Correr el test — verificar que pasa**

```bash
cd backend && npx jest src/scraping/price-parser.util.spec.ts --no-coverage
```

Expected: `PASS` — 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scraping/price-parser.util.ts backend/src/scraping/price-parser.util.spec.ts
git commit -m "feat(pm-12): add parsePrice utility with EU/US format detection"
```

---

## Task 3: `price.extractor.ts` — 4 estrategias + rawData enriquecido

**Files:**
- Create: `backend/src/scraping/price.extractor.spec.ts`
- Modify: `backend/src/scraping/price.extractor.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/src/scraping/price.extractor.spec.ts`:

```typescript
import { PriceExtractor } from './price.extractor';
import { Page } from 'playwright';

function makePage(config: {
  jsonLdTexts?: string[];
  microdataNodes?: Array<{ content: string | null; text: string | null }>;
  $evalResults?: Record<string, string | null>;
} = {}): Page {
  return {
    url: jest.fn().mockReturnValue('https://example.com/product'),
    $$eval: jest.fn().mockImplementation((selector: string) => {
      if (selector.includes('application/ld+json')) {
        return Promise.resolve(config.jsonLdTexts ?? []);
      }
      if (selector === '[itemprop="price"]') {
        return Promise.resolve(config.microdataNodes ?? []);
      }
      return Promise.resolve([]);
    }),
    $eval: jest.fn().mockImplementation((selector: string) => {
      const result = config.$evalResults?.[selector];
      if (result !== undefined && result !== null) return Promise.resolve(result);
      return Promise.reject(new Error('element not found'));
    }),
  } as unknown as Page;
}

describe('PriceExtractor', () => {
  let extractor: PriceExtractor;

  beforeEach(() => {
    extractor = new PriceExtractor();
  });

  describe('estrategia JSON-LD', () => {
    it('extrae precio de @type:Product con offers.price', async () => {
      const page = makePage({
        jsonLdTexts: [
          JSON.stringify({
            '@type': 'Product',
            name: 'Leche Nestlé',
            offers: { price: '1299.99' },
          }),
        ],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(1299.99);
      expect(result.detectedName).toBe('Leche Nestlé');
      expect(result.rawData).toMatchObject({ strategy: 'json-ld', source: 'jsonld.offers.price' });
    });

    it('extrae precio de @type:Product con offers.lowPrice cuando price está ausente', async () => {
      const page = makePage({
        jsonLdTexts: [
          JSON.stringify({
            '@type': 'Product',
            offers: { lowPrice: '850' },
          }),
        ],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(850);
      expect(result.rawData).toMatchObject({ strategy: 'json-ld', source: 'jsonld.offers.lowPrice' });
    });

    it('extrae precio de @type:Offer directo', async () => {
      const page = makePage({
        jsonLdTexts: [JSON.stringify({ '@type': 'Offer', price: '599' })],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(599);
      expect(result.rawData).toMatchObject({ strategy: 'json-ld', source: 'jsonld.direct.price' });
    });

    it('extrae lowPrice de @type:AggregateOffer', async () => {
      const page = makePage({
        jsonLdTexts: [JSON.stringify({ '@type': 'AggregateOffer', lowPrice: '499', highPrice: '799' })],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(499);
      expect(result.rawData).toMatchObject({ strategy: 'json-ld', source: 'jsonld.direct.lowPrice' });
    });

    it('extrae precio de un @graph que contiene un Product', async () => {
      const page = makePage({
        jsonLdTexts: [
          JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'WebPage' },
              { '@type': 'Product', name: 'Producto Graph', offers: { price: '1500' } },
            ],
          }),
        ],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(1500);
      expect(result.detectedName).toBe('Producto Graph');
    });

    it('toma el primer offer de un array de offers', async () => {
      const page = makePage({
        jsonLdTexts: [
          JSON.stringify({
            '@type': 'Product',
            offers: [{ price: '1200' }, { price: '1100' }],
          }),
        ],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(1200);
    });

    it('ignora JSON-LD malformado y sigue con el siguiente script', async () => {
      const page = makePage({
        jsonLdTexts: [
          'INVALID JSON {{{',
          JSON.stringify({ '@type': 'Product', offers: { price: '750' } }),
        ],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(750);
    });
  });

  describe('estrategia Meta', () => {
    it('extrae precio de og:price:amount', async () => {
      const page = makePage({
        $evalResults: {
          'meta[property="og:price:amount"], meta[name="og:price:amount"]': '1299',
          'meta[property="og:title"], meta[name="og:title"]': 'Leche Nestlé',
        },
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(1299);
      expect(result.detectedName).toBe('Leche Nestlé');
      expect(result.rawData).toMatchObject({ strategy: 'meta', source: 'meta.og:price:amount' });
    });

    it('cae en product:price:amount cuando og:price:amount no existe', async () => {
      const page = makePage({
        $evalResults: {
          'meta[property="product:price:amount"], meta[name="product:price:amount"]': '890',
        },
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(890);
      expect(result.rawData).toMatchObject({ strategy: 'meta', source: 'meta.product:price:amount' });
    });
  });

  describe('estrategia Microdata', () => {
    it('extrae precio del atributo content de [itemprop="price"]', async () => {
      const page = makePage({
        microdataNodes: [{ content: '1299.99', text: 'precio no confiable' }],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(1299.99);
      expect(result.rawData).toMatchObject({
        strategy: 'microdata',
        source: 'microdata.[itemprop=price].content',
        candidateCount: 1,
      });
    });

    it('usa textContent cuando content está ausente', async () => {
      const page = makePage({
        microdataNodes: [{ content: null, text: '$ 850' }],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(850);
      expect(result.rawData).toMatchObject({
        source: 'microdata.[itemprop=price].textContent',
      });
    });

    it('toma el primer nodo válido cuando hay múltiples', async () => {
      const page = makePage({
        microdataNodes: [
          { content: null, text: null },
          { content: '650', text: null },
          { content: '700', text: null },
        ],
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(650);
      expect(result.rawData).toMatchObject({ candidateCount: 3 });
    });

    it('retorna null cuando no hay nodos', async () => {
      const page = makePage({ microdataNodes: [] });
      // Sin JSON-LD, meta, ni microdata → falla también CSS
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBeNull();
      expect(result.rawData.strategy).toBe('none');
    });
  });

  describe('estrategia CSS', () => {
    it('extrae precio del selector .price vía textContent', async () => {
      const page = makePage({
        $evalResults: { '.price': '$1.299,99' },
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(1299.99);
      expect(result.rawData).toMatchObject({ strategy: 'css', source: 'css..price' });
    });

    it('extrae precio del atributo data-price', async () => {
      const page = makePage({
        $evalResults: { '[data-price]': '750' },
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(750);
      expect(result.rawData).toMatchObject({ strategy: 'css', source: 'css.[data-price]' });
    });
  });

  describe('fallback entre estrategias', () => {
    it('pasa a la siguiente estrategia si la anterior no encontró precio', async () => {
      // Solo tiene meta, sin JSON-LD ni microdata
      const page = makePage({
        $evalResults: {
          'meta[property="og:price:amount"], meta[name="og:price:amount"]': '999',
        },
      });
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBe(999);
      expect(result.rawData.strategy).toBe('meta');
    });

    it('retorna currentPrice: null y strategy: "none" si todas fallan', async () => {
      const page = makePage();
      const result = await extractor.extract(page);
      expect(result.currentPrice).toBeNull();
      expect(result.detectedName).toBeNull();
      expect(result.rawData).toEqual({ strategy: 'none' });
    });
  });

  describe('rawData', () => {
    it('incluye rawValue con el string original encontrado', async () => {
      const page = makePage({
        jsonLdTexts: [JSON.stringify({ '@type': 'Product', offers: { price: '$1.299,99' } })],
      });
      const result = await extractor.extract(page);
      expect(result.rawData.rawValue).toBe('$1.299,99');
    });
  });
});
```

- [ ] **Step 2: Correr los tests — verificar que fallan**

```bash
cd backend && npx jest src/scraping/price.extractor.spec.ts --no-coverage
```

Expected: múltiples `FAIL` por estrategias no implementadas aún (Microdata, variantes JSON-LD, rawData incompleto).

- [ ] **Step 3: Reemplazar el contenido de `price.extractor.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { parsePrice } from './price-parser.util';

export interface PriceExtractionResult {
  currentPrice: number | null;
  detectedName: string | null;
  rawData: Record<string, unknown>;
}

const CSS_PRICE_SELECTORS = [
  '.price',
  '[data-price]',
  '.precio',
  '#price',
  '.product-price',
  '[itemprop="price"]',
];

@Injectable()
export class PriceExtractor {
  private readonly logger = new Logger(PriceExtractor.name);

  async extract(page: Page): Promise<PriceExtractionResult> {
    const strategies = [
      () => this.fromJsonLd(page),
      () => this.fromMeta(page),
      () => this.fromMicrodata(page),
      () => this.fromCss(page),
    ];

    for (const strategy of strategies) {
      const result = await strategy().catch((err) => {
        this.logger.debug(`Strategy failed: ${err}`);
        return null;
      });
      if (result !== null && result.currentPrice !== null) {
        return result;
      }
    }

    this.logger.warn(`No price found on page: ${page.url()}`);
    return { currentPrice: null, detectedName: null, rawData: { strategy: 'none' } };
  }

  private async fromJsonLd(page: Page): Promise<PriceExtractionResult | null> {
    const scripts = await page.$$eval(
      'script[type="application/ld+json"]',
      (els) => els.map((el) => el.textContent ?? ''),
    );

    for (const text of scripts) {
      try {
        const parsed = JSON.parse(text) as unknown;
        for (const entry of this.flattenJsonLd(parsed)) {
          const result = this.extractFromJsonLdEntry(entry);
          if (result) return result;
        }
      } catch {
        // malformed JSON-LD — skip
      }
    }
    return null;
  }

  private flattenJsonLd(data: unknown): Record<string, unknown>[] {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data)) {
      return data.flatMap((item) => this.flattenJsonLd(item));
    }
    const obj = data as Record<string, unknown>;
    const entries: Record<string, unknown>[] = [obj];
    if (Array.isArray(obj['@graph'])) {
      entries.push(
        ...(obj['@graph'] as unknown[]).flatMap((item) => this.flattenJsonLd(item)),
      );
    }
    return entries;
  }

  private extractFromJsonLdEntry(obj: Record<string, unknown>): PriceExtractionResult | null {
    const type = obj['@type'];
    const name = typeof obj.name === 'string' ? obj.name : null;

    if (type === 'Product') {
      const offers = obj.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const offer = Array.isArray(offers) ? offers[0] : offers;
      if (!offer) return null;
      const rawValue = String(offer.price ?? offer.lowPrice ?? '');
      const source = offer.price != null ? 'jsonld.offers.price' : 'jsonld.offers.lowPrice';
      const currentPrice = parsePrice(rawValue);
      if (currentPrice !== null) {
        return { currentPrice, detectedName: name, rawData: { strategy: 'json-ld', rawValue, source } };
      }
    }

    if (type === 'Offer' || type === 'AggregateOffer') {
      const raw =
        type === 'AggregateOffer' ? (obj.lowPrice ?? obj.price) : (obj.price ?? obj.lowPrice);
      const rawValue = String(raw ?? '');
      const source =
        type === 'AggregateOffer'
          ? obj.lowPrice != null
            ? 'jsonld.direct.lowPrice'
            : 'jsonld.direct.price'
          : obj.price != null
            ? 'jsonld.direct.price'
            : 'jsonld.direct.lowPrice';
      const currentPrice = parsePrice(rawValue);
      if (currentPrice !== null) {
        return { currentPrice, detectedName: name, rawData: { strategy: 'json-ld', rawValue, source } };
      }
    }

    return null;
  }

  private async fromMeta(page: Page): Promise<PriceExtractionResult | null> {
    const metaSelectors: Array<[string, string]> = [
      [
        'meta[property="og:price:amount"], meta[name="og:price:amount"]',
        'meta.og:price:amount',
      ],
      [
        'meta[property="product:price:amount"], meta[name="product:price:amount"]',
        'meta.product:price:amount',
      ],
    ];

    for (const [selector, source] of metaSelectors) {
      const rawValue = await page
        .$eval(selector, (el) => el.getAttribute('content'))
        .catch(() => null);

      if (rawValue) {
        const currentPrice = parsePrice(rawValue);
        if (currentPrice !== null) {
          const name = await page
            .$eval(
              'meta[property="og:title"], meta[name="og:title"]',
              (el) => el.getAttribute('content'),
            )
            .catch(() => null);
          return { currentPrice, detectedName: name, rawData: { strategy: 'meta', rawValue, source } };
        }
      }
    }
    return null;
  }

  private async fromMicrodata(page: Page): Promise<PriceExtractionResult | null> {
    const nodes = await page
      .$$eval('[itemprop="price"]', (els) =>
        els.map((el) => ({
          content: el.getAttribute('content'),
          text: el.textContent ?? null,
        })),
      )
      .catch(() => [] as Array<{ content: string | null; text: string | null }>);

    const candidateCount = nodes.length;

    for (const node of nodes) {
      const rawValue = node.content ?? node.text ?? '';
      const source =
        node.content != null
          ? 'microdata.[itemprop=price].content'
          : 'microdata.[itemprop=price].textContent';
      const currentPrice = parsePrice(rawValue);
      if (currentPrice !== null) {
        return {
          currentPrice,
          detectedName: null,
          rawData: { strategy: 'microdata', rawValue, source, candidateCount },
        };
      }
    }
    return null;
  }

  private async fromCss(page: Page): Promise<PriceExtractionResult | null> {
    for (const selector of CSS_PRICE_SELECTORS) {
      const rawValue = await page
        .$eval(
          selector,
          (el) =>
            el.getAttribute('data-price') ??
            el.getAttribute('content') ??
            el.textContent,
        )
        .catch(() => null);

      if (rawValue) {
        const currentPrice = parsePrice(rawValue);
        if (currentPrice !== null) {
          return {
            currentPrice,
            detectedName: null,
            rawData: { strategy: 'css', rawValue, source: `css.${selector}` },
          };
        }
      }
    }
    return null;
  }
}
```

- [ ] **Step 4: Correr los tests — verificar que pasan**

```bash
cd backend && npx jest src/scraping/price.extractor.spec.ts --no-coverage
```

Expected: `PASS` — todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scraping/price.extractor.ts backend/src/scraping/price.extractor.spec.ts
git commit -m "feat(pm-12): PriceExtractor con 4 estrategias, Microdata, rawData enriquecido"
```

---

## Task 4: `promo.extractor.ts` — eliminar `parsePrice` duplicado

**Files:**
- Modify: `backend/src/scraping/promo.extractor.ts`

- [ ] **Step 1: Agregar import y eliminar método privado**

Reemplazar el inicio del archivo:

```typescript
import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { parsePrice } from './price-parser.util';
```

Y eliminar el método privado al final de la clase (líneas 114–122 del archivo actual):

```typescript
// ELIMINAR este bloque completo:
private parsePrice(text: string): number | null {
  const cleaned = text.trim().replace(/[^\d.,]/g, '');
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const value = parseFloat(normalized);
  return isNaN(value) || value <= 0 ? null : value;
}
```

- [ ] **Step 2: Correr todos los tests del módulo de scraping**

```bash
cd backend && npx jest src/scraping/ --no-coverage
```

Expected: `PASS` — todos los tests en verde, sin regresiones.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scraping/promo.extractor.ts
git commit -m "refactor(pm-12): promo.extractor usa parsePrice del util compartido"
```

---

## Task 5: Validación final

- [ ] **Step 1: Correr lint**

```bash
cd backend && npm run lint
```

Expected: sin errores. Si aparecen avisos de estilo, corregirlos antes de continuar.

- [ ] **Step 2: Correr build**

```bash
cd backend && npm run build
```

Expected: compilación exitosa sin errores de TypeScript.

- [ ] **Step 3: Correr suite completa**

```bash
cd backend && npm test -- --no-coverage
```

Expected: todos los tests en verde.

- [ ] **Step 4: Verificar que `ScrapingService` no requiere cambios**

Confirmar que `backend/src/scraping/scraping.service.ts` sigue importando `PriceExtractor` de `./price.extractor` sin cambios y que el build pasa. La interfaz `PriceExtractionResult` es idéntica — esto es solo verificación visual.

---

## Resumen de cambios

| Archivo | Cambio |
|---|---|
| `price-parser.util.ts` | NUEVO: `parsePrice()` con detección EU/US por posición del último separador |
| `price-parser.util.spec.ts` | NUEVO: 11 casos de prueba del parser |
| `price.extractor.ts` | MODIFICADO: 4 estrategias, JSON-LD con Offer/AggregateOffer/@graph, Microdata, rawData enriquecido |
| `price.extractor.spec.ts` | NUEVO: 18 tests cubriendo todas las estrategias y fallthrough |
| `promo.extractor.ts` | MODIFICADO: elimina `parsePrice` privado, importa del util |
