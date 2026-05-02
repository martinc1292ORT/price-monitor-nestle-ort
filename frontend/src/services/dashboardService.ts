// Usa la instancia de Axios con interceptores de auth ya configurada.
 
import { api } from './axiosInstance';
import type { DashboardSummary, PriceRow } from '../types/dashboard';
 
export async function fetchPriceRows(): Promise<PriceRow[]> {
  const { data } = await api.get<PriceRow[]>('/dashboard/prices');
  return data;
}
 
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/dashboard/summary');
  return data;
}
 
export function getUniqueProducts(rows: PriceRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.product)));
}