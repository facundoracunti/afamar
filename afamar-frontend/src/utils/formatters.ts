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
