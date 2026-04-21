import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';

export interface PromoExtractionResult {
  hasPromo: boolean;
  promoText: string | null;
  promoType: string | null;
  struckPrice: number | null;
  discountPct: number | null;
}

const PROMO_KEYWORDS = [
  'oferta',
  'descuento',
  'promo',
  'cyber',
  '% off',
  '2x1',
  'cuotas sin interés',
  'ahorrá',
  'precio especial',
];

const STRUCK_SELECTORS = [
  '.price-before',
  '.original-price',
  '.tachado',
  '.precio-anterior',
  'del',
  's',
];

const PROMO_BADGE_SELECTORS = [
  '.badge',
  '.tag',
  '.label',
  '[class*="promo"]',
  '[class*="oferta"]',
  '[class*="descuento"]',
];

@Injectable()
export class PromoExtractor {
  async extract(page: Page, currentPrice: number | null): Promise<PromoExtractionResult> {
    const [struckPrice, promoText, hasBadge] = await Promise.all([
      this.extractStruckPrice(page),
      this.extractPromoText(page),
      this.detectPromoBadge(page),
    ]);

    const hasPromo = struckPrice !== null || promoText !== null || hasBadge;
    const promoType = this.classifyPromoType(promoText);
    const discountPct = this.calcDiscountPct(currentPrice, struckPrice);

    return { hasPromo, promoText, promoType, struckPrice, discountPct };
  }

  private async extractStruckPrice(page: Page): Promise<number | null> {
    for (const selector of STRUCK_SELECTORS) {
      const text = await page.$eval(selector, (el) => el.textContent).catch(() => null);
      if (text) {
        const price = this.parsePrice(text);
        if (price !== null) return price;
      }
    }
    return null;
  }

  private async extractPromoText(page: Page): Promise<string | null> {
    const bodyText = await page
      .$eval('body', (el) => (el as HTMLElement).innerText.toLowerCase())
      .catch(() => '');

    for (const keyword of PROMO_KEYWORDS) {
      if (bodyText.includes(keyword)) {
        const idx = bodyText.indexOf(keyword);
        const snippet = bodyText
          .substring(Math.max(0, idx - 20), idx + 60)
          .trim()
          .replace(/\s+/g, ' ');
        return snippet;
      }
    }
    return null;
  }

  private async detectPromoBadge(page: Page): Promise<boolean> {
    for (const selector of PROMO_BADGE_SELECTORS) {
      const exists = await page
        .$(selector)
        .then((el) => el !== null)
        .catch(() => false);
      if (exists) return true;
    }
    return false;
  }

  private classifyPromoType(promoText: string | null): string | null {
    if (!promoText) return null;
    const t = promoText.toLowerCase();
    if (t.includes('2x1')) return '2x1';
    if (t.includes('cuota')) return 'installments';
    if (t.includes('%') || t.includes('descuento') || t.includes('off')) return 'discount';
    if (t.includes('cyber')) return 'discount';
    return 'other';
  }

  private calcDiscountPct(current: number | null, struck: number | null): number | null {
    if (current === null || struck === null || struck <= 0 || struck <= current) return null;
    const pct = ((struck - current) / struck) * 100;
    return Math.round(pct * 100) / 100;
  }

  private parsePrice(text: string): number | null {
    const cleaned = text.trim().replace(/[^\d.,]/g, '');
    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned;
    const value = parseFloat(normalized);
    return isNaN(value) || value <= 0 ? null : value;
  }
}
