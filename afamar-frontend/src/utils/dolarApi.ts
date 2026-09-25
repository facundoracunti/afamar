import http from '../api/http';

/**
 * Centralized USD quote for AFAMAR, served by the backend (`GET /dolar/rates`,
 * which proxies dolarapi.com and caches the result). One source of truth for
 * both the web UI and the legacy PDF generators.
 *
 * Two rates, by document type:
 *   - `official_sale_rate` — Dólar Oficial Venta. Used by **presupuestos**.
 *   - `blue_mid_rate`      — Dólar Blue promedio `(compra + venta) / 2`. Used
 *                            by **órdenes de trabajo** and cobros.
 *
 * Field names are kept snake_case to match the backend envelope (`res.data`
 * is already unwrapped by the http interceptor).
 */
export interface DolarRates {
  official_sale_rate: number;
  blue_mid_rate: number;
  updated_at?: string | null;
}

export type UsdRateSource = 'official' | 'blue_mid';

export function rateForSource(rates: DolarRates, source: UsdRateSource): number {
  return source === 'blue_mid' ? rates.blue_mid_rate : rates.official_sale_rate;
}

export async function fetchDolarRates(): Promise<DolarRates> {
  const res = await http.get<DolarRates>('/dolar/rates');
  return res.data;
}