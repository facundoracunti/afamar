/**
 * Tests for the "Dólar billete" mode of `PaymentModal`.
 *
 * Covers the USD conversion flow introduced for `efectivo_usd`:
 *  - the ARS→USD conversion of presets and the conversion panel.
 *  - the submit payload (native USD amount + ARS equivalent + rate).
 *  - the guard that blocks submitting without a valid `usdRate`.
 *  - the ARS-mode regression (no conversion, no ARS-equivalent fields).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentModal } from './PaymentModal';

vi.mock('../../../context/NotificationContext', () => ({
  useNotify: () => vi.fn(),
}));

vi.mock('@/api/resources/payway', () => ({
  createPaywayCheckout: vi.fn(),
}));

const BASE_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  montoTotal: 520_000,
  montoSeniaRequerida: 260_000,
  montoPagadoAcumulado: 0,
  saldoPendiente: 260_000,
};

describe('PaymentModal — "Dólar billete" (efectivo_usd)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the USD conversion panel with the blue-mid rate and ARS equivalent', () => {
    render(<PaymentModal {...BASE_PROPS} usdRate={2600} defaultMethod="efectivo_usd" />);

    const panel = screen.getByText(/Dólar billete — cotización Dólar Blue Intermedio:/i);
    expect(panel.textContent).toMatch(/2\.600,00/i);
    expect(panel.textContent).toContain('Dólar Blue Intermedio');

    // Equivalent en ARS = amount × usdRate. Con la seña sugerida (260.000 ARS
    // → 100 USD) el equivalente devuelve 260.000 ARS.
    const equivalent = screen.getByText(/Equivalente en ARS:/i);
    expect(equivalent.textContent).toMatch(/260\.000,/i);
  });

  it('converts the "Seña sugerida" preset to native USD using usdRate', () => {
    render(<PaymentModal {...BASE_PROPS} usdRate={2600} defaultMethod="efectivo_usd" />);

    // 260.000 ARS / 2600 = 100 USD → formato es-AR "US$ 100,00".
    const señaLabel = screen.getByText(/Seña sugerida/i);
    expect(señaLabel.textContent).toMatch(/100,00/);
    expect(señaLabel.textContent).not.toContain('260.000');

    // El monto a registrar se muestra en USD (moneda nativa del pago).
    expect(screen.getByText(/Monto a registrar:/i).parentElement?.textContent).toMatch(/100,00/);
  });

  it('blocks submitting without a valid usdRate', () => {
    render(<PaymentModal {...BASE_PROPS} usdRate={0} defaultMethod="efectivo_usd" />);

    const submit = screen.getByRole('button', { name: 'Registrar pago' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('emits the native USD amount with ARS equivalent and rate on submit', async () => {
    const onSubmit = vi.fn();
    render(
      <PaymentModal {...BASE_PROPS} onSubmit={onSubmit} usdRate={2600} defaultMethod="efectivo_usd" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'efectivo_usd',
        amount: 100,
        baseAmount: 100,
        currency: 'USD',
        amount_ars: 260_000,
        usd_rate: 2600,
      }),
    );
  });

  it('converts a custom ARS amount through the same rate', () => {
    const onSubmit = vi.fn();
    render(
      <PaymentModal {...BASE_PROPS} onSubmit={onSubmit} usdRate={2600} defaultMethod="efectivo_usd" />,
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[2]); // "Monto personalizado"
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'efectivo_usd',
        amount: 60,
        baseAmount: 60,
        currency: 'USD',
        amount_ars: 156_000,
        usd_rate: 2600,
      }),
    );
  });

  it('keeps ARS payments free of conversion fields (regression)', () => {
    const onSubmit = vi.fn();
    render(
      <PaymentModal {...BASE_PROPS} onSubmit={onSubmit} usdRate={2600} defaultMethod="efectivo" />,
    );

    // Sin panel de conversión en ARS.
    expect(screen.queryByText(/Dólar billete/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    const tx = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(tx.currency).toBe('ARS');
    expect(tx.amount).toBe(260_000);
    // Sin modo USD no hay conversión: las claves existen con `undefined`
    // (JSON.stringify las omite), nunca con un número.
    expect(tx.amount_ars).toBeUndefined();
    expect(tx.usd_rate).toBeUndefined();
  });
});