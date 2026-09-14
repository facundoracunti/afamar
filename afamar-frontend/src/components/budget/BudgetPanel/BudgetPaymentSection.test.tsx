import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BudgetPaymentSection } from './BudgetPaymentSection';
import { BudgetPanelProvider } from './BudgetPanelContext';
import { INITIAL_FORM } from '../../../hooks/entityFormConstants';
import type { EntityFormState, FormField } from '../../../types/form';
import type { PaymentMethod } from '../../../types/paymentMethod';

const EFECTIVO: PaymentMethod = {
  id: 1,
  name: 'EFECTIVO',
  label: 'EFECTIVO',
  color: null,
  is_active: true,
  sort_order: 1,
  type: 'NONE',
  value: 0,
  is_percentage: true,
  applies_to_installments: false,
};

const TARJETA_DEBITO: PaymentMethod = {
  id: 2,
  name: 'TARJETA DE DÉBITO',
  label: 'TARJETA DE DÉBITO',
  color: null,
  is_active: true,
  sort_order: 2,
  type: 'NONE',
  value: 0,
  is_percentage: true,
  applies_to_installments: false,
};

function makeForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return { ...INITIAL_FORM, ...overrides };
}

function Harness() {
  const [form, setForm] = useState<EntityFormState>(() => makeForm({
    total: 120000,
    total_usd: 80,
    payment_method: '',
    payment_method_id: null,
  }));
  const update = (field: FormField, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const noop = () => undefined;

  return (
    <BudgetPanelProvider
      form={form}
      setForm={setForm}
      update={update}
      num={(v) => Number(v) || 0}
      paymentMethods={[EFECTIVO, TARJETA_DEBITO]}
      financial={{
        handleTransportChange: noop,
        handleDepositCurrencyChange: (c) =>
          setForm((prev) => ({
            ...prev,
            deposit_currency: c,
            deposit_received: c === 'ARS' ? prev.deposit_received : 0,
            deposit_usd: c === 'USD' ? prev.deposit_usd : 0,
          })),
        handleDepositAmountChange: (v) =>
          setForm((prev) => ({
            ...prev,
            deposit_received: Number(v) || 0,
            deposit_usd: 0,
          })),
        handleUsdRateChange: noop,
      }}
      ui={{
        modoUSD: false,
        toggleModoUSD: noop,
        hayUSD: false,
        hayAlternativas: false,
        readOnly: false,
        saving: false,
      }}
    >
      <BudgetPaymentSection
        form={form}
        readOnly={false}
        saving={false}
        update={update}
        setForm={setForm}
        num={(v) => Number(v) || 0}
      />
    </BudgetPanelProvider>
  );
}

describe('BudgetPaymentSection — tarjeta cobra el 100%', () => {
  it('oculta la seña y muestra el pago total con tarjeta cuando el método es tarjeta', () => {
    render(<Harness />);

    const paySelect = screen.getByRole('combobox', { name: 'Forma de pago' });
    expect(screen.getByText('Seña recibida')).toBeTruthy();
    expect(screen.getByText('⚠ Saldo pendiente de cobro')).toBeTruthy();

    fireEvent.change(paySelect, { target: { value: '2' } });

    expect(screen.queryByText('Seña recibida')).toBeNull();
    expect(screen.getByText('Pago total con tarjeta')).toBeTruthy();
    expect(screen.getByText('$ 120.000,00')).toBeTruthy();
    expect(screen.getByText('✓ Pago cobrado (tarjeta)')).toBeTruthy();
    expect(screen.queryByText('✓ Saldo cobrado')).toBeNull();
    expect(screen.queryByText('⚠ Saldo pendiente de cobro')).toBeNull();
  });
});