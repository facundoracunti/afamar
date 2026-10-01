/**
 * Tests for `PaymentModal` — "Dólar billete" mode + confirmation step.
 *
 * Covers:
 *  - the ARS→USD conversion flow introduced for `efectivo_usd`.
 *  - the submit payload (native USD amount + ARS equivalent + rate).
 *  - the guards that block submitting without a valid `usdRate` or with
 *    no pending balance.
 *  - the explicit confirmation step ("¿Confirmás el registro de pago...?")
 *    that precedes the POST, including the `concept` derived from the.
 *  - the ARS-mode regression (no conversion, no ARS-equivalent fields).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('emits the native USD amount with ARS equivalent, rate and concept on confirm', async () => {
    const onSubmit = vi.fn();
    render(
      <PaymentModal {...BASE_PROPS} onSubmit={onSubmit} usdRate={2600} defaultMethod="efectivo_usd" />,
    );

    // Paso 1: el botón solo abre la confirmación — el POST NO se dispara aún.
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/¿Confirmás el registro de pago/i)).toBeTruthy();

    // Paso 2: "Sí, registrar pago" dispara el POST con el concepto del preset.
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar pago' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'efectivo_usd',
        amount: 100,
        baseAmount: 100,
        currency: 'USD',
        amount_ars: 260_000,
        usd_rate: 2600,
        concept: 'Seña',
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
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar pago' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'efectivo_usd',
        amount: 60,
        baseAmount: 60,
        currency: 'USD',
        amount_ars: 156_000,
        usd_rate: 2600,
        concept: 'Monto Personalizado',
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
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar pago' }));

    const tx = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(tx.currency).toBe('ARS');
    expect(tx.amount).toBe(260_000);
    expect(tx.concept).toBe('Seña');
    // Sin modo USD no hay conversión: las claves existen con `undefined`
    // (JSON.stringify las omite), nunca con un número.
    expect(tx.amount_ars).toBeUndefined();
    expect(tx.usd_rate).toBeUndefined();
  });
});

describe('PaymentModal — confirmación explícita', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call onSubmit until the second click confirms the concept', () => {
    const onSubmit = vi.fn();
    render(<PaymentModal {...BASE_PROPS} onSubmit={onSubmit} defaultMethod="efectivo" />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(onSubmit).not.toHaveBeenCalled();
    // El concepto vive dentro de un `<strong>` anidado — el matcher por
    // defecto de RTL no cruza sub-elementos, así que se usa el textContent
    // completo del párrafo de confirmación.
    expect(
      screen.getByText((content, element) => {
        const text = element?.textContent ?? '';
        return element?.tagName === 'P' && text.includes('bajo el concepto de Seña');
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).toBeNull();
  });

  it('Cancelar vuelve al formulario sin registrar (el POST nunca corre)', () => {
    const onSubmit = vi.fn();
    render(<PaymentModal {...BASE_PROPS} onSubmit={onSubmit} defaultMethod="efectivo" />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeTruthy();
  });

  it('blocks registration and warns when there is no pending balance', () => {
    render(<PaymentModal {...BASE_PROPS} saldoPendiente={0} defaultMethod="efectivo" />);

    const submit = screen.getByRole('button', { name: 'Registrar pago' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(
      screen.getByText(/No hay saldo pendiente — el cobro de esta orden está completo/i),
    ).toBeTruthy();
  });

  it('re-opens the edit view if the POST fails (catches inside the confirm)', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom'));
    render(<PaymentModal {...BASE_PROPS} onSubmit={onSubmit} defaultMethod="efectivo" />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    // El submit rechaza asincrónicamente; hay que dejar correr el microtask
    // del `catch` (que vuelve a `confirming=false`) antes de assertar.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar pago' }));
    });

    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeTruthy();
  });
});