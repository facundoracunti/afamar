export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
};

export const formatDate = (date: string | undefined | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-AR');
};

export const formatInputDate = (date: string | undefined | null): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Returns today's date in local time as YYYY-MM-DD.
 * `new Date().toISOString()` returns UTC, which can be a different calendar
 * day than the user's local day. Use this anywhere the form needs to default
 * to "today" for the user — default `date` on a new budget/work-order, the
 * date picker on the cash daily page, the default `scheduled_date` on a
 * new measurement, etc.
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const fabricationConcepts: string[] = [
  'LENGTH',
  'BASEBOARD',
  'FRONT',
  'CUTOUT_SINK',
  'CUTOUT_COOKTOP',
  'CUTOUT_DROPIN_SINK',
  'OTHER',
];

export const orderStatuses: string[] = [
  'MEASUREMENT',
  'WORKSHOP',
  'FINISHED',
  'DELIVERED',
  'CANCELLED',
];

export const budgetStatuses: string[] = [
  'PENDING',
  'ONLINE',
  'APPROVED',
  'REJECTED',
  'CONVERTED_TO_OT',
];

export const measurementStatuses: string[] = [
  'PENDING',
  'DONE',
  'CANCELLED',
];