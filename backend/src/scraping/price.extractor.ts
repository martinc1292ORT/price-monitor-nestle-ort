import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { parsePrice } from './price-parser.util';

export type PriceStrategy =
  | 'json-ld'
  | 'meta'
  | 'microdata'
  | 'learned'
  | 'css'
  | 'none';

export interface PriceExtractionResult {
  currentPrice: number | null;
  detectedName: string | null;
  strategy: PriceStrategy;
  winningCssSelector: string | null;
  rawData: Record<string, unknown>;
}

const CSS_PRICE_SELECTORS = [
  '.price',
  '[data-price]',
  '.precio',
  '#price',
  '.product-price',
];

@Injectable()
export class PriceExtractor {
  private readonly logger = new Logger(PriceExtractor.name);

  async extract(
    page: Page,
    learnedSelector: string | null = null,
  ): Promise<PriceExtractionResult> {
    const strategies: Array<() => Promise<PriceExtractionResult | null>> = [
      () => this.fromJsonLd(page),
      () => this.fromMeta(page),
      () => this.fromMicrodata(page),
    ];
    if (learnedSelector) {
      strategies.push(() => this.fromLearned(page, learnedSelector));
    }
    strategies.push(() => this.fromCss(page));

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
    return {
      currentPrice: null,
      detectedName: null,
      strategy: 'none',
      winningCssSelector: null,
      rawData: { strategy: 'none' },
    };
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
    if (Array.isArray(obj['@graph'])) {
      return (obj['@graph'] as unknown[]).flatMap((item) =>
        this.flattenJsonLd(item),
      );
    }
    return [obj];
  }

  private extractFromJsonLdEntry(
    obj: Record<string, unknown>,
  ): PriceExtractionResult | null {
    const type = obj['@type'];
    const name = typeof obj.name === 'string' ? obj.name : null;

    if (type === 'Product') {
      const offers = obj.offers as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined;
      const offer = Array.isArray(offers) ? offers[0] : offers;
      if (!offer) return null;
      const priceVal = offer.price ?? offer.lowPrice;
      if (typeof priceVal !== 'string' && typeof priceVal !== 'number')
        return null;
      const rawValue = String(priceVal);
      const source =
        offer.price != null ? 'jsonld.offers.price' : 'jsonld.offers.lowPrice';
      const currentPrice = parsePrice(rawValue);
      if (currentPrice !== null) {
        return {
          currentPrice,
          detectedName: name,
          strategy: 'json-ld',
          winningCssSelector: null,
          rawData: { strategy: 'json-ld', rawValue, source },
        };
      }
    }

    if (type === 'Offer' || type === 'AggregateOffer') {
      const raw =
        type === 'AggregateOffer'
          ? (obj.lowPrice ?? obj.price)
          : (obj.price ?? obj.lowPrice);
      if (typeof raw !== 'string' && typeof raw !== 'number') return null;
      const rawValue = String(raw);
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
        return {
          currentPrice,
          detectedName: name,
          strategy: 'json-ld',
          winningCssSelector: null,
          rawData: { strategy: 'json-ld', rawValue, source },
        };
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
            .$eval('meta[property="og:title"], meta[name="og:title"]', (el) =>
              el.getAttribute('content'),
            )
            .catch(() => null);
          return {
            currentPrice,
            detectedName: name,
            strategy: 'meta',
            winningCssSelector: null,
            rawData: { strategy: 'meta', rawValue, source },
          };
        }
      }
    }
    return null;
  }

  private async fromMicrodata(
    page: Page,
  ): Promise<PriceExtractionResult | null> {
    const nodes = await page
      .$$eval('[itemprop="price"]', (els) =>
        els.map((el) => ({
          content: el.getAttribute('content'),
          text: el.textContent ?? null,
        })),
      )
      .catch(
        () => [] as Array<{ content: string | null; text: string | null }>,
      );

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
          strategy: 'microdata',
          winningCssSelector: null,
          rawData: { strategy: 'microdata', rawValue, source, candidateCount },
        };
      }
    }
    return null;
  }

  private async fromLearned(
    page: Page,
    selector: string,
  ): Promise<PriceExtractionResult | null> {
    const rawValue = await page
      .$eval(
        selector,
        (el) =>
          el.getAttribute('data-price') ??
          el.getAttribute('content') ??
          el.textContent,
      )
      .catch(() => null);

    if (!rawValue) return null;
    const currentPrice = parsePrice(rawValue);
    if (currentPrice === null) return null;
    return {
      currentPrice,
      detectedName: null,
      strategy: 'learned',
      winningCssSelector: selector,
      rawData: { strategy: 'learned', rawValue, source: `learned.${selector}` },
    };
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
            strategy: 'css',
            winningCssSelector: selector,
            rawData: { strategy: 'css', rawValue, source: `css.${selector}` },
          };
        }
      }
    }
    return null;
  }
}
