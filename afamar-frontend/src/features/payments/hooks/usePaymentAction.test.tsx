/**
 * Tests for `usePaymentAction` — USD ("Dólar billete") + concept persistence
 * + server reconciliation.
 *
 * Covers the ARS-equivalent bookkeeping the module relies on:
 *  - persisted USD payments hydrate the accumulated total in ARS.
 *  - `registerPayment` POSTs the native USD amount + ARS conversion.
 *  - the accumulated total advances by the ARS equivalent, not the raw USD.
 *  - ARS payments carry no conversion fields.
 *  - the `Concepto:` marker is persisted in the description and re-derived
 *    by `conceptOf` / `isModulePayment` / `mapMovementToPayment`.
 *  - `reconcileFromServer` merges server-confirmed payments with the local
 *    session (server wins; reversals disappear).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaymentAction } from './usePaymentAction';
import {
  conceptOf,
  isModulePayment,
  mapMovementToPayment,
  resolveTotalPaidArs,
} from '../utils/paymentParsing';
import type { RegisteredPayment } from '../types/payment.types';
import { createCashMovement } from '../../../api/resources/cash';
import type { CashMovement } from '../../../types/cash';

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
  concept: 'Seña' as const,
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
        // El concepto se persiste en la descripción (marcador `Concepto:`).
        description: 'Concepto: Seña',
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
        concept: 'Saldo Restante',
      });
    });

    const payload = vi.mocked(createCashMovement).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.currency).toBe('ARS');
    // Sin modo USD no hay conversión: las claves existen con `undefined`
    // (JSON.stringify las omite), nunca con un número.
    expect(payload.amount_ars).toBeUndefined();
    expect(payload.usd_rate).toBeUndefined();
    expect(payload.description).toBe('Concepto: Saldo Restante');

    const tx = result.current.registeredTransactions[0];
    expect(tx.amount_ars).toBeNull();
    expect(tx.usd_rate).toBeNull();
    expect(tx.concept).toBe('Saldo Restante');
  });
});

describe('usePaymentAction — conceptos y reconciliación con el backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('conceptOf re-derives the concept from the persisted description', () => {
    expect(conceptOf('Concepto: Seña')).toBe('Seña');
    expect(conceptOf('Concepto: Saldo Restante — Lote/Cupón: 123')).toBe('Saldo Restante');
    expect(conceptOf(undefined)).toBeNull();
    expect(conceptOf('Ingreso manual por transferencia')).toBeNull();
    // Movimientos de seña legacy (`Seña A-000090 - Juan Pérez`).
    expect(conceptOf('Seña A-000090 - Juan Pérez')).toBe('Seña');
  });

  it('isModulePayment separates module movements from legacy/others', () => {
    expect(isModulePayment({ description: 'Concepto: Seña — Lote/Cupón: 123' })).toBe(true);
    expect(isModulePayment({ description: 'Seña A-000090 - Juan Pérez' })).toBe(false);
    expect(isModulePayment({ description: 'Ingreso general' })).toBe(false);
    expect(isModulePayment({ description: undefined })).toBe(false);
  });

  it('mapMovementToPayment derives method, concept, lote and link from a backend movement', () => {
    const movement = {
      id: 5,
      order_id: 42,
      type: 'INCOME',
      amount: 100,
      currency: 'USD',
      amount_ars: 260_000,
      usd_rate: 2600,
      payment_method: 'EFECTIVO (USD)',
      description:
        'Concepto: Seña — Lote/Cupón: 123 — Link de pago: https://payway.test/x',
      payway_checkout_url: 'https://payway.test/x',
      created_at: '2026-09-25T00:00:00Z',
    } as CashMovement;

    const tx = mapMovementToPayment(movement);
    expect(tx.cash_movement_id).toBe(5);
    expect(tx.method).toBe('efectivo_usd');
    expect(tx.concept).toBe('Seña');
    expect(tx.lote_cupon).toBe('123');
    expect(tx.payway_link_url).toBe('https://payway.test/x');
    expect(tx.amount).toBe(100);
    expect(tx.currency).toBe('USD');
    expect(tx.amount_ars).toBe(260_000);
    expect(tx.status).toBe('Pagado');
  });

  it('reconcileFromServer merges server + local (server wins, reversals disappear)', () => {
    window.localStorage.setItem(
      'afamar.ot.payments.42',
      JSON.stringify([
        // Pago local aún sin confirmar (POST pendiente o no persistido).
        persistedUsdTx({ id: 'local-1', cash_movement_id: null, amount: 50_000, currency: 'ARS', concept: 'Saldo Restante' }),
        // Espejo local de un movimiento que el server ya reversó.
        persistedUsdTx({ id: 'dup', cash_movement_id: 5 }),
      ]),
    );

    const { result } = renderHook(
      () => usePaymentAction({ orderId: 42, montoTotal: 520_000, montoPagadoAcumulado: 0, usdRate: 2600 }),
      { wrapper },
    );

    act(() => {
      result.current.reconcileFromServer([
        // El server ya no trae id5 (reversado); trae id8.
        persistedUsdTx({ id: 's-8', cash_movement_id: 8, status: 'Pagado', concept: 'Seña' }),
      ]);
    });

    const ids = result.current.registeredTransactions.map((t) => t.id);
    expect(ids).toContain('s-8');
    expect(ids).toContain('local-1');
    expect(ids).not.toContain('dup'); // la contraparte de id5 desaparece
    // Acumulado = id8 (260.000) + local-1 (50.000).
    expect(result.current.breakdown.monto_pagado_acumulado).toBe(310_000);
  });

  it('reconcileFromServer keeps prev when both server and local are empty', () => {
    const { result } = renderHook(
      () => usePaymentAction({ orderId: 42, montoTotal: 520_000, montoPagadoAcumulado: 0, usdRate: 2600 }),
      { wrapper },
    );

    const before = result.current.registeredTransactions;
    act(() => {
      result.current.reconcileFromServer([]);
    });

    expect(result.current.registeredTransactions).toBe(before);
    expect(result.current.registeredTransactions).toHaveLength(0);
  });
});

describe('resolveTotalPaidArs — PDF "Seña / Pagos Registrados" sin doble conteo', () => {
  it('el acumulado del módulo es el pago real cuando hay pagos registrados (nunca suma la seña del form)', () => {
    // BUG 2026-10-01: se mostraba total + paid (depósito autocompletado = total
    // + acumulado del módulo). El acumulado del módulo YA es la verdad.
    const total = 1_585_620;
    const depositEnArs = total; // seña del form autocompletada al total en OTs legacy/tarjeta
    const moduleAccumulated = 500_000; // pago real registrado + reconciliado con el backend
    expect(resolveTotalPaidArs(depositEnArs, moduleAccumulated)).toBe(500_000);
  });

  it('cae a la seña del form como fallback legacy cuando el módulo nunca registró pagos', () => {
    const depositEnArs = 300_000;
    expect(resolveTotalPaidArs(depositEnArs, 0)).toBe(300_000);
  });

  it('redondea a 2 decimales (ARS) y tolera acumulados con deriva de conversión', () => {
    const depositEnArs = 1_585_620;
    const moduleAccumulated = 500_000.1234567;
    expect(resolveTotalPaidArs(depositEnArs, moduleAccumulated)).toBe(500_000.12);
  });
});