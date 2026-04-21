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
