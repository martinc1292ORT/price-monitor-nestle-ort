export type PriceStatus = 'ok' | 'warning' | 'critical' | 'unknown';
 
// ── Matches GET /api/dashboard/prices ────────────────────────────────────────
export interface PriceRow {
  id: string;
  product: string;      // nombre del producto
  sku: string;
  retailer: string;     // nombre del retailer
  lastPrice: number;    // último precio capturado  (0 = sin dato)
  targetPrice: number;  // precio objetivo configurado
  diffPercent: number;  // (lastPrice - targetPrice) / targetPrice * 100
  status: PriceStatus;
  lastCapture: string;  // ISO date string
  hasPromo: boolean;
  promoText?: string;
}
 
// ── Matches GET /api/dashboard/summary ───────────────────────────────────────
export interface DashboardSummary {
  totalRetailers: number;
  activeAlerts: number;
  capturesLast24h: number;
  criticalOpenAlerts: number;
}
 
export type FilterStatus = 'all' | PriceStatus;
 
export interface DashboardFilters {
  product: string;       // product name or 'all'
  status: FilterStatus;
}