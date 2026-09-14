import type { Measurement } from '../types/measurement';

/**
 * Work-order ids that already have a measurement visit which is NOT
 * cancelled (pending, done or scheduled).
 *
 * The measurements list page uses this to hide a `MEASUREMENT` work order
 * from the "Órdenes pendientes de medición" cards as soon as a visit exists
 * — regardless of the agenda's date filter. A visit scheduled for another
 * day must NOT leave its card lingering in the pending grid; that is the
 * source of the "muchas cards, no sé cuál es nueva" confusion.
 */
export function computeScheduledWorkOrderIds(measurements: Measurement[]): Set<number> {
  const ids = new Set<number>();
  for (const m of measurements) {
    if (m.work_order_id && m.status !== 'CANCELLED') ids.add(m.work_order_id);
  }
  return ids;
}

/**
 * Counts measurement rows per status for the tab counters
 * (Todas / Pendientes / Realizadas / Canceladas). Unknown or empty statuses
 * fall back to PENDING so the counters stay stable even with legacy rows.
 */
export function countMeasurementStatuses(measurements: Measurement[]): Record<string, number> {
  const counts: Record<string, number> = { PENDING: 0, DONE: 0, CANCELLED: 0 };
  for (const m of measurements) {
    const key = m.status || 'PENDING';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}