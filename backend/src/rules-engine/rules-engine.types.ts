export type RuleType =
  | 'exact_price'
  | 'min_price'
  | 'max_price'
  | 'range'
  | 'no_promo';

export type RuleSeverity = 'info' | 'warning' | 'critical';

export type AlertType =
  | 'price_below'
  | 'price_above'
  | 'promo_detected'
  | 'struck_price'
  | 'not_found'
  | 'scraping_error';

export interface RuleEvaluationCapture {
  currentPrice: number | null;
  struckPrice: number | null;
  promoText: string | null;
  promoType: string | null;
  discountPct: number | null;
  checkResult?: string;
  hasPromo?: boolean;
}

export interface RuleEvaluationProduct {
  targetPrice: number;
  tolerance: number | null;
}

export interface RuleEvaluationRule {
  id: number;
  ruleType: RuleType;
  minPrice: number | null;
  maxPrice: number | null;
  allowPromos: boolean;
  maxDiscountPct: number | null;
  severity: RuleSeverity;
  isActive: boolean;
}

export interface RuleEvaluationInput {
  capture: RuleEvaluationCapture;
  product: RuleEvaluationProduct;
  rules: RuleEvaluationRule[];
}

export interface RuleEvaluationResult {
  ruleId: number;
  ruleType: RuleType;
  alertType: AlertType;
  severity: RuleSeverity;
  reason: string;
  detectedValue: number | null;
  expectedValue: number | null;
}
