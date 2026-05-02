import { RulesEngineService } from './rules-engine.service';
import {
  RuleEvaluationCapture,
  RuleEvaluationProduct,
  RuleEvaluationRule,
} from './rules-engine.types';

describe('RulesEngineService', () => {
  let service: RulesEngineService;

  const baseCapture: RuleEvaluationCapture = {
    currentPrice: 1000,
    struckPrice: null,
    promoText: null,
    promoType: null,
    discountPct: null,
    checkResult: 'ok',
    hasPromo: false,
  };

  const baseProduct: RuleEvaluationProduct = {
    targetPrice: 1000,
    tolerance: 2.5,
  };

  const makeRule = (
    overrides: Partial<RuleEvaluationRule> = {},
  ): RuleEvaluationRule => ({
    id: 1,
    ruleType: 'exact_price',
    minPrice: null,
    maxPrice: null,
    allowPromos: false,
    maxDiscountPct: null,
    severity: 'warning',
    isActive: true,
    ...overrides,
  });

  beforeEach(() => {
    service = new RulesEngineService();
  });

  it('ignora reglas inactivas', () => {
    const result = service.evaluate(
      { ...baseCapture, currentPrice: 900 },
      baseProduct,
      [makeRule({ isActive: false })],
    );

    expect(result).toEqual([]);
  });

  it('no alerta exact_price cuando el precio esta dentro de tolerancia o justo en el limite', () => {
    const inside = service.evaluate(
      { ...baseCapture, currentPrice: 1020 },
      baseProduct,
      [makeRule()],
    );
    const atBoundary = service.evaluate(
      { ...baseCapture, currentPrice: 1025 },
      baseProduct,
      [makeRule()],
    );

    expect(inside).toEqual([]);
    expect(atBoundary).toEqual([]);
  });

  it('genera price_below para exact_price por debajo de tolerancia', () => {
    const result = service.evaluate(
      { ...baseCapture, currentPrice: 950 },
      baseProduct,
      [makeRule({ severity: 'info' })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        ruleId: 1,
        ruleType: 'exact_price',
        alertType: 'price_below',
        severity: 'info',
        detectedValue: 950,
        expectedValue: 1000,
      }),
    ]);
  });

  it('genera price_above para exact_price por encima de tolerancia', () => {
    const result = service.evaluate(
      { ...baseCapture, currentPrice: 1030 },
      baseProduct,
      [makeRule({ severity: 'critical' })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        alertType: 'price_above',
        severity: 'critical',
        detectedValue: 1030,
        expectedValue: 1000,
      }),
    ]);
  });

  it('usa tolerancia 0 cuando product.tolerance es null', () => {
    const result = service.evaluate(
      { ...baseCapture, currentPrice: 1000.01 },
      { ...baseProduct, tolerance: null },
      [makeRule()],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        alertType: 'price_above',
        expectedValue: 1000,
      }),
    );
  });

  it('evalua min_price y max_price contra umbrales absolutos', () => {
    const belowMin = service.evaluate(baseCapture, baseProduct, [
      makeRule({ ruleType: 'min_price', minPrice: 1001 }),
    ]);
    const aboveMax = service.evaluate(baseCapture, baseProduct, [
      makeRule({ ruleType: 'max_price', maxPrice: 999 }),
    ]);

    expect(belowMin).toEqual([
      expect.objectContaining({
        alertType: 'price_below',
        detectedValue: 1000,
        expectedValue: 1001,
      }),
    ]);
    expect(aboveMax).toEqual([
      expect.objectContaining({
        alertType: 'price_above',
        detectedValue: 1000,
        expectedValue: 999,
      }),
    ]);
  });

  it('evalua range para limite inferior y superior', () => {
    const belowRange = service.evaluate(
      { ...baseCapture, currentPrice: 799 },
      baseProduct,
      [makeRule({ ruleType: 'range', minPrice: 800, maxPrice: 1200 })],
    );
    const aboveRange = service.evaluate(
      { ...baseCapture, currentPrice: 1201 },
      baseProduct,
      [makeRule({ ruleType: 'range', minPrice: 800, maxPrice: 1200 })],
    );

    expect(belowRange).toEqual([
      expect.objectContaining({
        alertType: 'price_below',
        detectedValue: 799,
        expectedValue: 800,
      }),
    ]);
    expect(aboveRange).toEqual([
      expect.objectContaining({
        alertType: 'price_above',
        detectedValue: 1201,
        expectedValue: 1200,
      }),
    ]);
  });

  it('omite reglas de precio si currentPrice es null', () => {
    const result = service.evaluate(
      { ...baseCapture, currentPrice: null },
      baseProduct,
      [
        makeRule(),
        makeRule({ id: 2, ruleType: 'min_price', minPrice: 900 }),
        makeRule({ id: 3, ruleType: 'max_price', maxPrice: 1100 }),
        makeRule({ id: 4, ruleType: 'range', minPrice: 900, maxPrice: 1100 }),
      ],
    );

    expect(result).toEqual([]);
  });

  it('omite reglas incompletas sin lanzar error', () => {
    const result = service.evaluate(baseCapture, baseProduct, [
      makeRule({ ruleType: 'min_price', minPrice: null }),
      makeRule({ ruleType: 'max_price', maxPrice: null }),
      makeRule({ ruleType: 'range', minPrice: null, maxPrice: null }),
    ]);

    expect(result).toEqual([]);
  });

  it('genera no_promo critical por precio tachado', () => {
    const result = service.evaluate(
      { ...baseCapture, struckPrice: 1200 },
      baseProduct,
      [makeRule({ ruleType: 'no_promo', severity: 'info' })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        alertType: 'struck_price',
        severity: 'critical',
        detectedValue: 1200,
        expectedValue: null,
      }),
    ]);
  });

  it('genera no_promo critical por texto promocional', () => {
    const result = service.evaluate(
      { ...baseCapture, promoText: '  20% off  ' },
      baseProduct,
      [makeRule({ ruleType: 'no_promo', severity: 'warning' })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        alertType: 'promo_detected',
        severity: 'critical',
        detectedValue: null,
      }),
    ]);
  });

  it('genera no_promo critical por discountPct', () => {
    const result = service.evaluate(
      { ...baseCapture, discountPct: 15 },
      baseProduct,
      [makeRule({ ruleType: 'no_promo' })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        alertType: 'promo_detected',
        severity: 'critical',
        detectedValue: 15,
      }),
    ]);
  });

  it('genera no_promo critical por hasPromo', () => {
    const result = service.evaluate(
      { ...baseCapture, hasPromo: true },
      baseProduct,
      [makeRule({ ruleType: 'no_promo' })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        alertType: 'promo_detected',
        severity: 'critical',
        detectedValue: null,
      }),
    ]);
  });

  it('no genera no_promo cuando no hay senales promocionales', () => {
    const result = service.evaluate(baseCapture, baseProduct, [
      makeRule({ ruleType: 'no_promo' }),
    ]);

    expect(result).toEqual([]);
  });

  it('escala cualquier regla a critical si discountPct supera maxDiscountPct', () => {
    const result = service.evaluate(
      { ...baseCapture, currentPrice: 800, discountPct: 25 },
      baseProduct,
      [makeRule({ ruleType: 'min_price', minPrice: 900, maxDiscountPct: 10 })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        alertType: 'price_below',
        severity: 'critical',
      }),
    ]);
  });

  it('no escala severidad si discountPct es igual a maxDiscountPct', () => {
    const result = service.evaluate(
      { ...baseCapture, currentPrice: 800, discountPct: 10 },
      baseProduct,
      [
        makeRule({
          ruleType: 'min_price',
          minPrice: 900,
          maxDiscountPct: 10,
          severity: 'warning',
        }),
      ],
    );

    expect(result).toEqual([
      expect.objectContaining({
        alertType: 'price_below',
        severity: 'warning',
      }),
    ]);
  });
});
