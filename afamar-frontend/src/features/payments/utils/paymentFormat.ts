/**
 * Formateo y redondeo compartido del módulo paños. No depende de React —
 * puro, unit-testable. `OrderPaymentSummary` conserva su propia copia de
 * `formatCurrency`/`CURRENCY_FORMATTERS` (decisión de scope de esa sesión:
 * no se arrastra ese refactor acá).
 */

const CURRENCY_FORMATTERS = {
  ARS: new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  USD: new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
} as const;

/** Formatea un monto en pesos o dólares (es-AR, siempre 2 decimales). */
export function formatCurrency(
  value: number,
  currency: 'ARS' | 'USD' = 'ARS',
): string {
  return CURRENCY_FORMATTERS[currency].format(value);
}

const EPSILON = 1e-9;

/** Redondeo comercial a 2 decimales con tolerancia a errores de punto
 *  flotante (0.1 + 0.2 → 0.3, no 0.30000000000000004). */
export function round2(n: number): number {
  return Math.round((n + EPSILON) * 100) / 100;
}

/** Convierte ARS → USD con la cotización del Dólar Blue Intermedio
 *  (`usdRate`). Devuelve 0 si la cotización no está disponible o es <= 0. */
export function usdFromArs(ars: number, usdRate: number): number {
  if (!usdRate || usdRate <= 0) return 0;
  return round2(ars / usdRate);
}

/** Convierte USD → ARS con la misma cotización (guard de rate <= 0 → 0). */
export function arsFromUsd(usd: number, usdRate: number): number {
  if (!usdRate || usdRate <= 0) return 0;
  return round2(usd * usdRate);
}