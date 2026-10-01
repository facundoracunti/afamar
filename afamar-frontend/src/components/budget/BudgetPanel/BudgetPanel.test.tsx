import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BudgetPanel from './BudgetPanel';
import { BudgetPanelProvider } from './BudgetPanelContext';
import { INITIAL_FORM } from '../../../hooks/entityFormConstants';
import type { EntityFormState } from '../../../types/form';
import type { FormField } from '../../../types/form';

function makeForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return { ...INITIAL_FORM, ...overrides };
}

interface RenderArgs {
  form: EntityFormState;
  hayAlternativas: boolean;
  alternativasGrid?: React.ReactNode;
}

function renderBudgetPanel({ form, hayAlternativas, alternativasGrid }: RenderArgs) {
  const noop = () => undefined;
  const update = (_field: FormField, _value: unknown) => undefined;
  return render(
    <MemoryRouter>
      <BudgetPanelProvider
        form={form}
        setForm={noop as never}
        update={update}
        num={(v) => Number(v) || 0}
        financial={{
          handleTransportChange: noop,
          handleDepositCurrencyChange: noop,
          handleDepositAmountChange: noop,
          handleUsdRateChange: noop,
        }}
        ui={{
          modoUSD: false,
          toggleModoUSD: noop,
          hayUSD: false,
          hayAlternativas,
          readOnly: true,
          saving: false,
        }}
      >
        <BudgetPanel alternativasGrid={alternativasGrid} />
      </BudgetPanelProvider>
    </MemoryRouter>,
  );
}

describe('BudgetPanel — line items survive when there are alternatives', () => {
  it('renders the line items + currency columns + payment section even when hayAlternativas=true', () => {
    const form = makeForm({
      usd_rate: 1000,
      materials_data: [
        { id: 'm1', name: 'ROJO OLAVARRIA', length: 1, width: 1, quantity: 1, price_m2: 200000, currency: 'ARS' } as never,
        { id: 'm2', name: 'MARQUINA BRILLANTE', length: 1, width: 1, quantity: 1, price_m2: 532000, currency: 'ARS', is_alternative: true } as never,
      ],
      fabrication_details: [
        { concept: 'OTHER', detail: 'Traforo de Pileta', price: 60000, quantity: 1, currency: 'ARS' } as never,
      ],
    });

    const { container } = renderBudgetPanel({
      form,
      hayAlternativas: true,
      alternativasGrid: <div data-testid="alternativas-grid">OPCIONES DE COTIZACIÓN DISPONIBLES</div>,
    });

    const text = container.textContent || '';

    expect(text).toContain('ROJO OLAVARRIA');
    expect(text).not.toContain('MARQUINA BRILLANTE');
    expect(text).toContain('Traforo de Pileta');
    expect(text).toContain('SUBTOTALES');
    expect(text).toContain('TOTAL ARS');
    expect(text).toContain('SALDO PENDIENTE');
    expect(container.querySelector('[data-testid="alternativas-grid"]')).not.toBeNull();
  });

  it('does NOT render Traslado/Forma de pago/Fechas — presupuesto es cotización pura', () => {
    const { container } = renderBudgetPanel({
      form: makeForm({ usd_rate: 1000 }),
      hayAlternativas: false,
    });

    const text = container.textContent || '';
    // El presupuesto ya no captura cobros: el cobro vive exclusivamente
    // en la OT (módulo de pagos / WorkOrderPaymentSection).
    expect(text).not.toContain('Traslado');
    expect(text).not.toContain('Forma de pago');
    expect(text).not.toContain('Seña recibida');
    expect(text).not.toContain('Fecha de entrega estimada');
    expect(text).not.toContain('Fecha de aprobación');
    expect(text).not.toContain('Detalle de cuotas');
  });
});