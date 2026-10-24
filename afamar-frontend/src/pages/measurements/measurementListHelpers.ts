/**
 * Pure sorting helpers of the measurements list page.
 *
 * Extracted verbatim from `MeasurementsListPage.tsx` so the ORDER of the rows
 * (pending work-order cards and the measurements table) stays exactly the
 * same.
 */
import type { Measurement } from '../../types/measurement';
import type { WorkOrderListItem } from '../../types/workOrder';
import type { PendingMeasurementSort } from '../../components/measurements/PendingMeasurementCards/PendingMeasurementCards';

export type SortField =
  | 'client_name'
  | 'client_phone'
  | 'client_address'
  | 'scheduled_date'
  | 'scheduled_time'
  | 'status';

export type SortDir = 'asc' | 'desc';

/**
 * Sorts the work orders of the "pendientes de medición" cards: by client, by
 * number, by creation date or by delivery date (the default).
 */
export function sortPendingOrders(
  orders: WorkOrderListItem[],
  sort: PendingMeasurementSort,
): WorkOrderListItem[] {
  const sorted = [...orders];
  sorted.sort((a, b) => {
    if (sort === 'client_asc') {
      return (a.client_name || '').localeCompare(b.client_name || '', 'es', { sensitivity: 'base' });
    }
    if (sort === 'number_asc') {
      return a.number.localeCompare(b.number, 'es', { numeric: true });
    }
    if (sort === 'created_asc' || sort === 'created_desc') {
      const comparison = (a.created_at || '').localeCompare(b.created_at || '');
      return sort === 'created_asc' ? comparison : -comparison;
    }
    const dateA = a.delivery_date || '';
    const dateB = b.delivery_date || '';
    if (!dateA && dateB) return 1;
    if (dateA && !dateB) return -1;
    return dateA.localeCompare(dateB);
  });
  return sorted;
}

/**
 * Sorts the measurements table rows by the selected column. Empty values are
 * always pushed to the end (asc or desc) so they never hide real data.
 */
export function sortMeasurementRows(
  rows: Measurement[],
  field: SortField,
  dir: SortDir,
): Measurement[] {
  const sorted = [...rows].sort((a, b) => {
    const rawA = (a[field] ?? '') as string;
    const rawB = (b[field] ?? '') as string;
    const aEmpty = rawA === '' || rawA == null;
    const bEmpty = rawB === '' || rawB == null;
    if (aEmpty && !bEmpty) return 1;
    if (!aEmpty && bEmpty) return -1;
    if (aEmpty && bEmpty) return 0;
    let cmp = 0;
    if (rawA < rawB) cmp = -1;
    else if (rawA > rawB) cmp = 1;
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}
