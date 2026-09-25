/**
 * Tests for `usePaymentAction` — USD ("Dólar billete") integration.
 *
 * Covers the ARS-equivalent bookkeeping the module relies on:
 *  - persisted USD payments hydrate the accumulated total in ARS.
 *  - `registerPayment` POSTs the native USD amount + ARS conversion.
 *  - the accumulated total advances by the ARS equivalent, not the raw USD.
 *  - ARS payments carry no conversion fields.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaymentAction, type RegisteredPayment } from './usePaymentAction';
import { createCashMovement } from '../../../api/resources/cash';

vi.mock('../../../api/resources/cash', () => ({
  createCashMovement: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const BASE_TX = {
  method: 'efectivo_usd' as const,
  amount: 100,
  currency: 'USD' as const,
  amount_ars: 260_000,
  usd_rate: 2600,
  lote_cupon: null,
  payway_link_url: null,
};

function persistedUsdTx(overrides: Record<string, unknown> = {}): RegisteredPayment {
  return {
    id: '1',
    order_id: 42,
    budget_id: null,
    method: 'efectivo_usd',
    amount: 100,
    currency: 'USD',
    amount_ars: 260_000,
    usd_rate: 2600,
    status: 'Pendiente',
    cash_movement_id: 5,
    lote_cupon: null,
    payway_link_url: null,
    registered_at: '2026-09-25T00:00:00Z',
    tarjeta_surcharge_percent: null,
    ...overrides,
  };
}

describe('usePaymentAction — USD (efectivo_usd)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('hydrates a persisted USD payment into the accumulated ARS total', () => {
    window.localStorage.setItem(
      'afamar.ot.payments.42',
      JSON.stringify([persistedUsdTx()]),
    );

    const { result } = renderHook(
      () =>
        usePaymentAction({
          orderId: 42,
          montoTotal: 520_000,
          montoPagadoAcumulado: 0,
          usdRate: 2600,
        }),
      { wrapper },
    );

    // El acumulado suma el equivalente ARS (260.000), NO el USD crudo (100).
    expect(result.current.breakdown.monto_pagado_acumulado).toBe(260_000);
    expect(result.current.breakdown.saldo_pendiente).toBe(260_000);
    expect(result.current.breakdown.status).toBe('Señado Parcial');
  });

  it('falls back to usdRate product when the ARS equivalent is missing', () => {
    window.localStorage.setItem(
      'afamar.ot.payments.42',
      JSON.stringify([persistedUsdTx({ amount_ars: null, usd_rate: null })]),
    );

    const { result } = renderHook(
      () =>
        usePaymentAction({
          orderId: 42,
          montoTotal: 520_000,
          montoPagadoAcumulado: 0,
          usdRate: 2600,
        }),
      { wrapper },
    );

    expect(result.current.breakdown.monto_pagado_acumulado).toBe(260_000);
  });

  it('registers a USD payment posting native USD + ARS equivalent and advances in ARS', async () => {
    vi.mocked(createCashMovement).mockResolvedValue({
      data: { id: 99, created_at: '2026-09-25T00:00:00Z' },
    } as never);

    const { result } = renderHook(
      () =>
        usePaymentAction({
          orderId: 42,
          orderNumber: 'A-000090',
          clientName: 'Juan Pérez',
          montoTotal: 520_000,
          montoPagadoAcumulado: 0,
          usdRate: 2600,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.registerPayment(BASE_TX);
    });

    expect(createCashMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INCOME',
        amount: 100,
        currency: 'USD',
        amount_ars: 260_000,
        usd_rate: 2600,
        payment_method: 'EFECTIVO (USD)',
        order_id: 42,
        order_number: 'A-000090',
      }),
    );

    // El acumulado avanza por el equivalente ARS del pago en USD.
    expect(result.current.breakdown.monto_pagado_acumulado).toBe(260_000);
    expect(result.current.breakdown.saldo_pendiente).toBe(260_000);
  });

  it('keeps ARS payments free of conversion fields', async () => {
    vi.mocked(createCashMovement).mockResolvedValue({
      data: { id: 100, created_at: '2026-09-25T00:00:00Z' },
    } as never);

    const { result } = renderHook(
      () =>
        usePaymentAction({
          orderId: 42,
          montoTotal: 520_000,
          montoPagadoAcumulado: 0,
          usdRate: 2600,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.registerPayment({
        method: 'efectivo',
        amount: 50_000,
        currency: 'ARS',
        lote_cupon: null,
        payway_link_url: null,
      });
    });

    const payload = vi.mocked(createCashMovement).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.currency).toBe('ARS');
    // Sin modo USD no hay conversión: las claves existen con `undefined`
    // (JSON.stringify las omite), nunca con un número.
    expect(payload.amount_ars).toBeUndefined();
    expect(payload.usd_rate).toBeUndefined();

    const tx = result.current.registeredTransactions[0];
    expect(tx.amount_ars).toBeNull();
    expect(tx.usd_rate).toBeNull();
  });
});