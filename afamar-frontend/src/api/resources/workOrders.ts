import http from '../http';

// Re-export the shared status mapper so existing imports keep working.
export { mapWorkOrderStatusToApi } from '../statusMap';

export const getWorkOrders = (params?: Record<string, unknown>) => http.get('/work-orders', { params });
export const getWorkOrder = (id: number | string) => http.get(`/work-orders/${id}`);
export const getWorkOrderPayments = (id: number | string) => http.get(`/work-orders/${id}/payments`);
/** Reversión admin de un pago de la OT: elimina el `CashMovement`
 *  asociado y recomputa el pagado/saldo pendiente (ver
 *  `WorkOrderService.reverse_payment`). Endpoint admin-only. */
export const deleteWorkOrderPayment = (id: number | string, movementId: number | string) =>
  http.delete(`/work-orders/${id}/payments/${movementId}`);
export const createWorkOrder = (data: Record<string, unknown>) => http.post('/work-orders', data);
export const updateWorkOrder = (id: number | string, data: Record<string, unknown>) => http.put(`/work-orders/${id}`, data);
export const deleteWorkOrder = (id: number | string) => http.delete(`/work-orders/${id}`);
export const cancelWorkOrderWithRecovery = (
  id: number | string,
  recoveries: Array<{ requirement_id: number; recovered_quantity: number }>,
  paymentsConfirmed = false,
) => http.post(`/work-orders/${id}/cancel-with-recovery`, {
  recoveries,
  payments_confirmed: paymentsConfirmed,
});
export const getNextWorkOrderNumber = () => http.get('/work-orders/next-number');
export const getWorkOrderPdf = (id: number | string) => `${http.defaults.baseURL}/work-orders/${id}/pdf`;
export const getWorkOrderPdfBlob = (id: number | string) =>
  http.get(`/work-orders/${id}/pdf`, { responseType: 'blob' });
export const getWorkOrderPublicPdfToken = (id: number | string) => http.get(`/work-orders/${id}/public-token`);
export const getMeasurementAdjustment = (id: number | string) =>
  http.get(`/work-orders/${id}/measurement-adjustment`);
export const approveMeasurementAdjustment = (
  id: number | string,
  data: { measurement_fingerprint: string; previous_total: number; previous_total_usd: number },
) => http.post(`/work-orders/${id}/measurement-adjustment`, data);
