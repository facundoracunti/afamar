import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BudgetLineItems } from './BudgetLineItems';
import { INITIAL_FORM } from '../../../hooks/entityFormConstants';
import type { EntityFormState } from '../../../types/form';

function makeForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return { ...INITIAL_FORM, ...overrides };
}

describe('BudgetLineItems — additional works rendering', () => {
  it('renders one line per additional work (flat) and uses price * quantity when total missing', () => {
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 1,
        name: 'Pulido de bordes',
        detail: 'Pulido fino',
        price: 15000,
        currency: 'ARS',
        quantity: 2,
        total: 30000,
        materialName: '__GLOBAL__',
        type: 'flat',
      },
    ]);
    const { container } = render(
      <MemoryRouter>
        <BudgetLineItems
          form={makeForm({ additional_works_data, usd_rate: 1000 })}
          fabricationDetails={[]}
          materials={[]}
          pools={[]}
        />
      </MemoryRouter>,
    );
    const text = container.textContent || '';
    expect(text).toContain('Pulido de bordes - Pulido fino x2');
    expect(text).toContain('30.000,00');
    expect(text).toContain('US$ 30,00');
  });

  it('renders a frente row with linear_meters label and the frozen `total`', () => {
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 24,
        name: 'Frente doble',
        detail: 'Borde recto',
        price: 0,
        currency: 'ARS',
        quantity: 1,
        total: 26000,
        materialName: 'Negro Brasil',
        type: 'frente',
        linear_meters: 1,
        formula_values: {
          material_price_m2_at_selection: 200000,
          multiplier: 1.15,
          computed_at: '2026-01-01T00:00:00.000Z',
        },
      },
    ]);
    const { container } = render(
      <MemoryRouter>
        <BudgetLineItems
          form={makeForm({ additional_works_data, usd_rate: 1000 })}
          fabricationDetails={[]}
          materials={[]}
          pools={[]}
        />
      </MemoryRouter>,
    );
    const text = container.textContent || '';
    expect(text).toContain('Frente doble - Borde recto (1 ml) [Frente]');
    expect(text).toContain('26.000,00');
  });

  it('omits rows whose subtotal is zero (matches useBudgetCalculations)', () => {
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 9,
        name: 'Bisel',
        price: 100,
        currency: 'ARS',
        quantity: 1,
        total: 0,
        materialName: '__GLOBAL__',
        type: 'flat',
      },
    ]);
    const { container } = render(
      <MemoryRouter>
        <BudgetLineItems
          form={makeForm({ additional_works_data, usd_rate: 1000 })}
          fabricationDetails={[]}
          materials={[]}
          pools={[]}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).not.toMatch(/Bisel/);
  });
});
