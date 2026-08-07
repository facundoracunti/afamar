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
    expect(text).toContain('[GLOBAL]');
    expect(text).toContain('30.000,00');
    expect(text).toContain('≈ US$ 30,00');
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
    expect(text).toContain('≈ US$');
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

describe('BudgetLineItems — global indicator', () => {
  it('marks pool as [GLOBAL] when material is __GLOBAL__', () => {
    const pools = [
      { pool_id: 1, brand: 'Johnson', model: 'E36', price: 50000, currency: 'ARS', quantity: 1, material: '__GLOBAL__' },
    ];
    const { container } = render(
      <MemoryRouter>
        <BudgetLineItems form={makeForm({ usd_rate: 1000 })} fabricationDetails={[]} materials={[]} pools={pools as never} />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('Pileta Johnson - E36 [GLOBAL]');
  });

  it('marks additional work as [GLOBAL] when materialName is __GLOBAL__', () => {
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 1, name: 'Pulido', price: 5000, currency: 'ARS', quantity: 1, total: 5000,
        materialName: '__GLOBAL__', type: 'flat',
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
    expect(container.textContent).toContain('Pulido [GLOBAL]');
  });

  it('marks fabrication detail as [GLOBAL] when material is empty', () => {
    const fabricationDetails = [
      { concept: 'BASEBOARD', detail: 'Zócalo', material: '', material_price_m2: 0, length: 0, width: 0, m2: 0, labor: null, currency: 'ARS', quantity: 2, price: 10000 },
    ];
    const { container } = render(
      <MemoryRouter>
        <BudgetLineItems
          form={makeForm({ usd_rate: 1000 })}
          fabricationDetails={fabricationDetails as never}
          materials={[]}
          pools={[]}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('[GLOBAL]');
  });
});

describe('BudgetLineItems — alt-linked items hidden from Presupuesto', () => {
  // Los alternativos van via form.materials_data (NO via prop `materials`,
  // que BudgetPanel ya filtra a main-only). Esto reproduce el bug que
  // tenía la implementación previa.
  const altMaterialsInForm = [
    { id: 1, name: 'NEGRO BRASIL', price_m2: 0, price_m2_usd: 0, currency: 'ARS' as const, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 0, width: 0, is_alternative: true },
  ];
  const mainMaterialsInForm = [
    { id: 1, name: 'GRIS MARA', price_m2: 0, price_m2_usd: 0, currency: 'ARS' as const, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 0, width: 0, is_alternative: false },
  ];

  it('hides pool tied to an alternative from Presupuesto', () => {
    const pools = [
      { pool_id: 1, brand: 'Johnson', model: 'E36', price: 50000, currency: 'ARS' as const, quantity: 1, material: 'NEGRO BRASIL' },
    ];
    const { container } = render(
      <MemoryRouter>
        <BudgetLineItems
          form={makeForm({ usd_rate: 1000, materials_data: altMaterialsInForm })}
          fabricationDetails={[]}
          materials={[]}  // simula BudgetPanel: ya filtrado a main-only
          pools={pools as never}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).not.toContain('Johnson');
  });

  it('keeps pool tied to the main material in Presupuesto', () => {
    const pools = [
      { pool_id: 1, brand: 'Johnson', model: 'E36', price: 50000, currency: 'ARS' as const, quantity: 1, material: 'GRIS MARA' },
    ];
    const { container } = render(
      <MemoryRouter>
        <BudgetLineItems
          form={makeForm({ usd_rate: 1000, materials_data: mainMaterialsInForm })}
          fabricationDetails={[]}
          materials={mainMaterialsInForm}
          pools={pools as never}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('Pileta Johnson');
  });

  it('hides additional work tied to an alternative (prefix __ALT__:) even when materials prop is empty', () => {
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 1, name: 'Frente', price: 5000, currency: 'ARS', quantity: 1, total: 5000,
        materialName: '__ALT__:NEGRO BRASIL', type: 'frente',
      },
    ]);
    const { container } = render(
      <MemoryRouter>
        <BudgetLineItems
          form={makeForm({ additional_works_data, usd_rate: 1000, materials_data: altMaterialsInForm })}
          fabricationDetails={[]}
          materials={[]}
          pools={[]}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).not.toContain('Frente');
  });
});
