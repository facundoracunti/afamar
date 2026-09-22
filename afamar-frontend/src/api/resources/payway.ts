/**
 * Payway payment-link API client.
 *
 * `POST /payments/payway/checkout` returns a checkout URL for the
 * order. In production with `PAYWAY_API_KEY` configured, the backend
 * calls the real Payway gateway. In dev mode, the backend generates a
 * deterministic placeholder URL (see `app/api/routers/payway.py`).
 */
import http from '../http';
import type { ApiResponse } from '../../types/api';

export interface PaywayCheckoutRequest {
  order_id: number;
  order_number: string;
  client_name?: string | null;
  amount: number;
  currency?: 'ARS' | 'USD';
  description?: string | null;
}

export interface PaywayCheckoutResponse {
  checkout_url: string;
  movement_id: number | null;
  is_placeholder: boolean;
}

export const createPaywayCheckout = (
  req: PaywayCheckoutRequest,
): ApiResponse<PaywayCheckoutResponse> =>
  http.post('/payments/payway/checkout', req);
