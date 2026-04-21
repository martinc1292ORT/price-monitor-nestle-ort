import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';

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
    const rawData: Record<string, unknown> = {};

    const jsonLd = await this.fromJsonLd(page).catch((err) => {
      this.logger.debug(`JSON-LD failed: ${err}`);
      return null;
    });
    if (jsonLd?.currentPrice !== null && jsonLd !== null) {
      rawData.strategy = 'json-ld';
      return { ...jsonLd, rawData };
    }

    const meta = await this.fromMeta(page).catch((err) => {
      this.logger.debug(`Meta failed: ${err}`);
      return null;
    });
    if (meta?.currentPrice !== null && meta !== null) {
      rawData.strategy = 'meta';
      return { ...meta, rawData };
    }

    const css = await this.fromCss(page).catch((err) => {
      this.logger.debug(`CSS failed: ${err}`);
      return null;
    });
    if (css?.currentPrice !== null && css !== null) {
      rawData.strategy = 'css';
      return { ...css, rawData };
    }

    rawData.strategy = 'none';
    return { currentPrice: null, detectedName: null, rawData };
  }

  private async fromJsonLd(
    page: Page,
  ): Promise<{ currentPrice: number | null; detectedName: string | null }> {
    const scripts = await page.$$eval(
      'script[type="application/ld+json"]',
      (els) => els.map((el) => el.textContent ?? ''),
    );

    for (const text of scripts) {
      try {
        const data = JSON.parse(text);
        const entries: unknown[] = Array.isArray(data) ? data : [data];
        for (const entry of entries) {
          if (
            entry &&
            typeof entry === 'object' &&
            (entry as Record<string, unknown>)['@type'] === 'Product'
          ) {
            const obj = entry as Record<string, unknown>;
            const offers = obj.offers as Record<string, unknown> | Record<string, unknown>[];
            const offer = Array.isArray(offers) ? offers[0] : offers;
            const price = offer?.price ?? offer?.lowPrice ?? null;
            const name = typeof obj.name === 'string' ? obj.name : null;
            if (price !== null) {
              return { currentPrice: parseFloat(String(price)), detectedName: name };
            }
          }
        }
      } catch {
        // malformed JSON-LD — skip
      }
    }
    return { currentPrice: null, detectedName: null };
  }

  private async fromMeta(
    page: Page,
  ): Promise<{ currentPrice: number | null; detectedName: string | null }> {
    const price = await page
      .$eval(
        'meta[property="og:price:amount"], meta[name="og:price:amount"]',
        (el) => el.getAttribute('content'),
      )
      .catch(() => null);

    const name = await page
      .$eval(
        'meta[property="og:title"], meta[name="og:title"]',
        (el) => el.getAttribute('content'),
      )
      .catch(() => null);

    if (price) {
      const parsed = this.parsePrice(price);
      return { currentPrice: parsed, detectedName: name };
    }
    return { currentPrice: null, detectedName: null };
  }

  private async fromCss(
    page: Page,
  ): Promise<{ currentPrice: number | null; detectedName: string | null }> {
    for (const selector of CSS_PRICE_SELECTORS) {
      const text = await page
        .$eval(
          selector,
          (el) =>
            el.getAttribute('data-price') ??
            el.getAttribute('content') ??
            el.textContent,
        )
        .catch(() => null);

      if (text) {
        const price = this.parsePrice(text);
        if (price !== null) {
          return { currentPrice: price, detectedName: null };
        }
      }
    }
    return { currentPrice: null, detectedName: null };
  }

  private parsePrice(text: string): number | null {
    // Remove currency symbols and spaces, normalize decimal separator
    const cleaned = text.trim().replace(/[^\d.,]/g, '');
    // Handle "1.299,99" (European) → "1299.99"
    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned;
    const value = parseFloat(normalized);
    return isNaN(value) || value <= 0 ? null : value;
  }
}
