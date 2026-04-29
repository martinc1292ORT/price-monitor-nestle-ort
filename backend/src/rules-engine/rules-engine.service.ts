import { Injectable } from '@nestjs/common';
import {
  AlertType,
  RuleEvaluationCapture,
  RuleEvaluationProduct,
  RuleEvaluationResult,
  RuleEvaluationRule,
  RuleSeverity,
} from './rules-engine.types';

@Injectable()
export class RulesEngineService {
  evaluate(
    capture: RuleEvaluationCapture,
    product: RuleEvaluationProduct,
    rules: RuleEvaluationRule[],
  ): RuleEvaluationResult[] {
    return rules.flatMap((rule) => {
      if (!rule.isActive) return [];

      switch (rule.ruleType) {
        case 'exact_price':
          return this.evaluateExactPrice(capture, product, rule);
        case 'min_price':
          return this.evaluateMinPrice(capture, rule);
        case 'max_price':
          return this.evaluateMaxPrice(capture, rule);
        case 'range':
          return this.evaluateRange(capture, rule);
        case 'no_promo':
          return this.evaluateNoPromo(capture, rule);
        default:
          return [];
      }
    });
  }

  private evaluateExactPrice(
    capture: RuleEvaluationCapture,
    product: RuleEvaluationProduct,
    rule: RuleEvaluationRule,
  ): RuleEvaluationResult[] {
    const currentPrice = capture.currentPrice;
    const targetPrice = product.targetPrice;

    if (
      !this.isPositiveNumber(currentPrice) ||
      !this.isPositiveNumber(targetPrice)
    ) {
      return [];
    }

    const tolerance = product.tolerance ?? 0;
    const deviationPct =
      (Math.abs(currentPrice - targetPrice) / targetPrice) * 100;

    if (deviationPct <= tolerance) return [];

    const alertType: AlertType =
      currentPrice < targetPrice ? 'price_below' : 'price_above';
    const direction = currentPrice < targetPrice ? 'debajo' : 'encima';

    return [
      this.createResult(rule, capture, {
        alertType,
        detectedValue: currentPrice,
        expectedValue: targetPrice,
        reason: `Precio capturado ${currentPrice} esta ${this.roundPercent(
          deviationPct,
        )}% por ${direction} del objetivo ${targetPrice}, superando tolerancia ${tolerance}%.`,
      }),
    ];
  }

  private evaluateMinPrice(
    capture: RuleEvaluationCapture,
    rule: RuleEvaluationRule,
  ): RuleEvaluationResult[] {
    const currentPrice = capture.currentPrice;
    const minPrice = rule.minPrice;

    if (!this.isPositiveNumber(currentPrice) || !this.isNumber(minPrice)) {
      return [];
    }

    if (currentPrice >= minPrice) return [];

    return [
      this.createResult(rule, capture, {
        alertType: 'price_below',
        detectedValue: currentPrice,
        expectedValue: minPrice,
        reason: `Precio capturado ${currentPrice} esta por debajo del minimo ${minPrice}.`,
      }),
    ];
  }

  private evaluateMaxPrice(
    capture: RuleEvaluationCapture,
    rule: RuleEvaluationRule,
  ): RuleEvaluationResult[] {
    const currentPrice = capture.currentPrice;
    const maxPrice = rule.maxPrice;

    if (!this.isPositiveNumber(currentPrice) || !this.isNumber(maxPrice)) {
      return [];
    }

    if (currentPrice <= maxPrice) return [];

    return [
      this.createResult(rule, capture, {
        alertType: 'price_above',
        detectedValue: currentPrice,
        expectedValue: maxPrice,
        reason: `Precio capturado ${currentPrice} esta por encima del maximo ${maxPrice}.`,
      }),
    ];
  }

  private evaluateRange(
    capture: RuleEvaluationCapture,
    rule: RuleEvaluationRule,
  ): RuleEvaluationResult[] {
    const currentPrice = capture.currentPrice;

    if (!this.isPositiveNumber(currentPrice)) return [];

    if (this.isNumber(rule.minPrice) && currentPrice < rule.minPrice) {
      return [
        this.createResult(rule, capture, {
          alertType: 'price_below',
          detectedValue: currentPrice,
          expectedValue: rule.minPrice,
          reason: `Precio capturado ${currentPrice} esta por debajo del rango minimo ${rule.minPrice}.`,
        }),
      ];
    }

    if (this.isNumber(rule.maxPrice) && currentPrice > rule.maxPrice) {
      return [
        this.createResult(rule, capture, {
          alertType: 'price_above',
          detectedValue: currentPrice,
          expectedValue: rule.maxPrice,
          reason: `Precio capturado ${currentPrice} esta por encima del rango maximo ${rule.maxPrice}.`,
        }),
      ];
    }

    return [];
  }

  private evaluateNoPromo(
    capture: RuleEvaluationCapture,
    rule: RuleEvaluationRule,
  ): RuleEvaluationResult[] {
    const signal = this.getPromoSignal(capture);

    if (!signal) return [];

    return [
      {
        ruleId: rule.id,
        ruleType: rule.ruleType,
        alertType: signal.alertType,
        severity: 'critical',
        reason: signal.reason,
        detectedValue: signal.detectedValue,
        expectedValue: null,
      },
    ];
  }

  private createResult(
    rule: RuleEvaluationRule,
    capture: RuleEvaluationCapture,
    result: Omit<RuleEvaluationResult, 'ruleId' | 'ruleType' | 'severity'>,
  ): RuleEvaluationResult {
    return {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      severity: this.resolveSeverity(rule, capture),
      ...result,
    };
  }

  private resolveSeverity(
    rule: RuleEvaluationRule,
    capture: RuleEvaluationCapture,
  ): RuleSeverity {
    if (
      this.shouldEscalateByDiscount(capture.discountPct, rule.maxDiscountPct)
    ) {
      return 'critical';
    }

    return rule.severity;
  }

  private shouldEscalateByDiscount(
    discountPct: number | null,
    maxDiscountPct: number | null,
  ): boolean {
    return (
      this.isNumber(discountPct) &&
      this.isNumber(maxDiscountPct) &&
      discountPct > maxDiscountPct
    );
  }

  private getPromoSignal(capture: RuleEvaluationCapture): {
    alertType: AlertType;
    reason: string;
    detectedValue: number | null;
  } | null {
    if (this.isNumber(capture.struckPrice)) {
      return {
        alertType: 'struck_price',
        reason: `Promocion detectada por precio tachado ${capture.struckPrice}.`,
        detectedValue: capture.struckPrice,
      };
    }

    if (capture.promoText?.trim()) {
      return {
        alertType: 'promo_detected',
        reason: 'Promocion detectada por texto promocional.',
        detectedValue: null,
      };
    }

    if (this.isNumber(capture.discountPct)) {
      return {
        alertType: 'promo_detected',
        reason: `Promocion detectada por descuento de ${capture.discountPct}%.`,
        detectedValue: capture.discountPct,
      };
    }

    if (capture.hasPromo === true) {
      return {
        alertType: 'promo_detected',
        reason: 'Promocion detectada por senal del extractor.',
        detectedValue: null,
      };
    }

    return null;
  }

  private isNumber(value: number | null): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private isPositiveNumber(value: number | null): value is number {
    return this.isNumber(value) && value > 0;
  }

  private roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
