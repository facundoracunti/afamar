import http from '../http';
import type { UnifiedBudget } from '../../types/budget';

export const getBudgets = (params?: Record<string, unknown>) => http.get('/budgets', { params });
export const getBudgetsUnified = (params?: Record<string, unknown>) => http.get('/budgets/unified', { params });
export const getBudget = (id: number | string) => http.get(`/budgets/${id}`);
export const createBudget = (data: Record<string, unknown>) => http.post('/budgets', data);
export const updateBudget = (id: number | string, data: Record<string, unknown>) => http.put(`/budgets/${id}`, data);
export const deleteBudget = (id: number | string) => http.delete(`/budgets/${id}`);
export const convertBudgetToWorkOrder = (id: number | string) => http.post(`/work-orders/from-budget/${id}`);
export const sendBudgetWhatsApp = (id: number | string) => http.post(`/budgets/${id}/send-whatsapp`);
export const sendBudgetEmail = (id: number | string) => http.post(`/budgets/${id}/send-email`);
export const getNextBudgetNumber = () => http.get('/budgets/next-number');
export const getBudgetPdf = (id: number | string) => `${http.defaults.baseURL}/budgets/${id}/pdf`;
export const convertAlternativeToWorkOrder = (budgetId: number | string, idx: number) =>
  http.post(`/budgets/${budgetId}/alternatives/${idx}/convert-to-work-order`);

export const mapBudgetStatusToApi = (status: string): Record<string, unknown> => ({
  status: {
    'PENDIENTE': 'PENDING',
    'APROBADO': 'APPROVED',
    'RECHAZADO': 'REJECTED',
    'CONVERTIDO A OT': 'CONVERTED_TO_OT',
  }[status] || status,
});

interface UnifiedBudgetRaw {
  id: number;
  tipo?: string;
  number?: string;
  date?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  material?: string | null;
  total?: number;
  total_usd?: number;
  status?: string;
  work_order_number?: string | null;
  created_at?: string;
  deposit_received?: number;
  balance_due?: number;
  design_observations?: string | null;
  materials?: Array<{ name: string }>;
  items?: Array<{ detail: string; material?: string }>;
}

/**
 * Backend `GET /budgets/unified` returns snake_case keys plus `tipo` instead of
 * `type`. This mapper translates them so the frontend can keep using camelCase
 * fields on `UnifiedBudget` (which is what the rest of the code expects).
 */
export function mapUnifiedBudget(raw: UnifiedBudgetRaw): UnifiedBudget {
  return {
    type: raw.tipo === 'online' ? 'online' : 'local',
    id: raw.id,
    number: raw.number || '',
    workOrderNumber: raw.work_order_number || undefined,
    date: raw.date || '',
    clientName: raw.client_name || undefined,
    clientPhone: raw.client_phone || undefined,
    materials: raw.materials,
    items: raw.items,
    material: raw.material || undefined,
    designObservations: raw.design_observations || undefined,
    total: raw.total || 0,
    status: raw.status || '',
  };
}