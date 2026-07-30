/**
 * Status value maps shared between Budget and WorkOrder resources.
 *
 * The legacy Spanish labels are still used by some operator-facing UIs.
 * These maps translate them to the backend's enum values so the wire
 * format stays consistent regardless of which label the operator
 * picked. New code should send the English value directly — these are
 * only kept for the click-handlers in the list-page action bars.
 */

export const BUDGET_STATUS_MAP: Record<string, string> = {
  PENDIENTE: 'PENDING',
  APROBADO: 'APPROVED',
  RECHAZADO: 'REJECTED',
  'CONVERTIDO A OT': 'CONVERTED_TO_OT',
};

export const WORK_ORDER_STATUS_MAP: Record<string, string> = {
  MEDICION: 'MEASUREMENT',
  TALLER: 'WORKSHOP',
  TERMINADA: 'FINISHED',
  ENTREGADA: 'DELIVERED',
  CANCELADA: 'CANCELLED',
};

export function mapBudgetStatusToApi(status: string): Record<string, unknown> {
  return { status: BUDGET_STATUS_MAP[status] || status };
}

export function mapWorkOrderStatusToApi(status: string): Record<string, unknown> {
  return { status: WORK_ORDER_STATUS_MAP[status] || status };
}