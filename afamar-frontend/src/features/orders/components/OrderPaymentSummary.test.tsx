/**
 * Tests for `OrderPaymentSummary` — payment history table + admin reversal.
 *
 * Covers:
 *  - the Concepto column renders the persisted concept (`—` fallback).
 *  - the reversal flow: admin-only Acción column, per-row "↩ Reversar"
 *    (only for persisted payments), ConfirmDialog → `onReversePayment`.
 *  - non-admin render hides the reversal UI entirely.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrderPaymentSummary, type PaymentHistoryEntry } from './OrderPaymentSummary';

function baseProps() {
  return {
    montoTotal: 520_000,
    montoSeniaRequerida: 260_000,
    montoPagadoAcumulado: 260_000,
    saldoPendiente: 260_000,
    status: 'Señado Parcial' as const,
    preferredMethod: null,
    onPreferredMethodChange: vi.fn(),
  };
}

function persistedTx(overrides: Partial<PaymentHistoryEntry> = {}): PaymentHistoryEntry {
  return {
    id: '1',
    order_id: 42,
    budget_id: null,
    method: 'efectivo',
    amount: 260_000,
    currency: 'ARS',
    status: 'Pagado',
    cash_movement_id: 5,
    lote_cupon: null,
    payway_link_url: null,
    registered_at: '2026-09-25T00:00:00Z',
    tarjeta_surcharge_percent: null,
    concept: 'Seña',
    ...overrides,
  };
}

describe('OrderPaymentSummary — historial de pagos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Concepto column and the persisted concept of each payment', () => {
    render(
      <OrderPaymentSummary
        {...baseProps()}
        paymentHistory={[
          persistedTx({ concept: 'Seña' }),
          persistedTx({ id: '2', cash_movement_id: 6, concept: 'Saldo Restante' }),
        ]}
      />,
    );

    expect(screen.getByText('Pagos registrados')).toBeTruthy();
    expect(screen.getByText('Concepto')).toBeTruthy();
    expect(screen.getByText('Seña')).toBeTruthy();
    expect(screen.getByText('Saldo Restante')).toBeTruthy();
  });

  it('falls back to "—" for payments without a concept', () => {
    render(
      <OrderPaymentSummary
        {...baseProps()}
        paymentHistory={[persistedTx({ concept: null })]}
      />,
    );

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('hides the reversal UI (Acción column and buttons) for non-admin', () => {
    render(
      <OrderPaymentSummary
        {...baseProps()}
        paymentHistory={[persistedTx()]}
        isAdmin={false}
        onReversePayment={vi.fn()}
      />,
    );

    expect(screen.queryByText('Acción')).toBeNull();
    expect(screen.queryByRole('button', { name: '↩ Reversar' })).toBeNull();
  });
});

describe('OrderPaymentSummary — reversión de pago (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the Acción column and a reverse button per persisted payment', () => {
    render(
      <OrderPaymentSummary
        {...baseProps()}
        paymentHistory={[persistedTx(), persistedTx({ id: '2', cash_movement_id: 6 })]}
        isAdmin
        onReversePayment={vi.fn()}
      />,
    );

    expect(screen.getByText('Acción')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '↩ Reversar' })).toHaveLength(2);
  });

  it('only offers reversal for persisted payments (cash_movement_id present)', () => {
    render(
      <OrderPaymentSummary
        {...baseProps()}
        paymentHistory={[
          persistedTx(), // cash_movement_id 5 → reversable
          persistedTx({ id: 'local', cash_movement_id: null }), // local → no reversable
        ]}
        isAdmin
        onReversePayment={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: '↩ Reversar' })).toHaveLength(1);
  });

  it('confirms the reversal and fires onReversePayment with the row', () => {
    const onReversePayment = vi.fn();
    const tx = persistedTx();
    render(
      <OrderPaymentSummary
        {...baseProps()}
        paymentHistory={[tx]}
        isAdmin
        onReversePayment={onReversePayment}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '↩ Reversar' }));

    expect(
      screen.getByText(/¿Confirmás la reversión del pago de.*Efectivo · Seña/i),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, reversar' }));

    expect(onReversePayment).toHaveBeenCalledTimes(1);
    expect(onReversePayment).toHaveBeenCalledWith(tx);
  });

  it('Cancelar cierra el diálogo sin reversar', () => {
    const onReversePayment = vi.fn();
    render(
      <OrderPaymentSummary
        {...baseProps()}
        paymentHistory={[persistedTx()]}
        isAdmin
        onReversePayment={onReversePayment}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '↩ Reversar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onReversePayment).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});