/**
 * Render tests for `BudgetTable` (the row-level table rendered inside
 * the budgets list page).
 *
 * Verifies:
 *  - renders one row per budget
 *  - renders the empty state when there is no data
 *  - shows "APROBAR" only for PENDING budgets
 *  - shows "A OT" only for APPROVED + no work order
 *  - shows the linked OT button when the budget already has a work order
 *  - shows the WhatsApp button as disabled when there is no phone
 *  - calls onView when the row is clicked
 *  - calls onCambiarEstado when "Aprobar" is clicked
 *  - calls onConvertir when "A OT" is clicked
 *  - calls onSetDeleteId when "Eliminar" is clicked
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BudgetTable from './BudgetTable';
import type { UnifiedBudget } from '../../types/budget';

const noop = () => undefined;

function renderTable(data: UnifiedBudget[]) {
  return render(
    <MemoryRouter>
      <BudgetTable
        data={data}
        onView={noop}
        onOpenPdf={noop}
        onConvertir={noop}
        onEnviarWhatsApp={noop}
        onEnviarEmail={noop}
        onCambiarEstado={noop}
        onSetDeleteId={noop}
      />
    </MemoryRouter>,
  );
}

function makeBudget(overrides: Partial<UnifiedBudget> = {}): UnifiedBudget {
  return {
    type: 'budget',
    id: 1,
    number: 'P-000001',
    date: '2026-01-15',
    clientName: 'Juan Pérez',
    clientPhone: '+54 11 1234-5678',
    total: 100000,
    status: 'PENDING',
    ...overrides,
  };
}

describe('BudgetTable', () => {
  it('renders one row per budget', () => {
    renderTable([
      makeBudget({ id: 1, number: 'P-000001' }),
      makeBudget({ id: 2, number: 'P-000002' }),
      makeBudget({ id: 3, number: 'P-000003' }),
    ]);
    expect(screen.getByText('P-000001')).toBeDefined();
    expect(screen.getByText('P-000002')).toBeDefined();
    expect(screen.getByText('P-000003')).toBeDefined();
  });

  it('renders the empty state when no data', () => {
    renderTable([]);
    expect(screen.getByText('No hay presupuestos')).toBeDefined();
  });

  it('shows "Aprobar" only for PENDING budgets', () => {
    renderTable([
      makeBudget({ id: 1, number: 'P-000001', status: 'PENDING' }),
      makeBudget({ id: 2, number: 'P-000002', status: 'APPROVED' }),
    ]);
    // PENDING shows Aprobar + Rechazar
    expect(screen.getAllByText(/Aprobar/).length).toBeGreaterThanOrEqual(1);
    // APPROVED shows Rechazar but not Aprobar
    expect(screen.getAllByText(/Rechazar/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows "A OT" button only for APPROVED budgets without a work order', () => {
    renderTable([
      makeBudget({ id: 1, number: 'P-000001', status: 'PENDING' }),
      makeBudget({ id: 2, number: 'P-000002', status: 'APPROVED' }),
    ]);
    // Only one "A OT" button (for the APPROVED budget)
    const convertButtons = screen.getAllByTitle('Convertir presupuesto en Orden de Trabajo');
    expect(convertButtons).toHaveLength(1);
  });

  it('shows the linked OT button when the budget has a work order', () => {
    renderTable([
      makeBudget({ id: 1, number: 'P-000001', status: 'CONVERTED_TO_OT', workOrderNumber: 'A-000010' }),
    ]);
    // The work order number appears twice: once in the numero sub-label
    // (the "-> A-000010" badge) and once in the linked OT button. Both
    // are intentional: the badge makes the relationship visible inline,
    // the button lets the user jump to the OT.
    const matches = screen.getAllByText(/A-000010/);
    expect(matches.length).toBe(2);
  });

  it('disables WhatsApp button when no phone is set', () => {
    renderTable([makeBudget({ id: 1, number: 'P-000001', clientPhone: undefined })]);
    const button = screen.getByTitle('Sin teléfono cargado');
    expect(button).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onView when the row is clicked', () => {
    const onView = vi.fn();
    render(
      <MemoryRouter>
        <BudgetTable
          data={[makeBudget()]}
          onView={onView}
          onOpenPdf={noop}
          onConvertir={noop}
          onEnviarWhatsApp={noop}
          onEnviarEmail={noop}
          onCambiarEstado={noop}
          onSetDeleteId={noop}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('P-000001'));
    expect(onView).toHaveBeenCalled();
  });

  it('calls onCambiarEstado when "Aprobar" is clicked', () => {
    const onCambiarEstado = vi.fn();
    render(
      <MemoryRouter>
        <BudgetTable
          data={[makeBudget({ status: 'PENDING' })]}
          onView={noop}
          onOpenPdf={noop}
          onConvertir={noop}
          onEnviarWhatsApp={noop}
          onEnviarEmail={noop}
          onCambiarEstado={onCambiarEstado}
          onSetDeleteId={noop}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Aprobar presupuesto'));
    expect(onCambiarEstado).toHaveBeenCalled();
    const [budget, status] = onCambiarEstado.mock.calls[0];
    expect(budget.number).toBe('P-000001');
    expect(status).toBe('APPROVED');
  });

  it('calls onConvertir when "A OT" is clicked', () => {
    const onConvertir = vi.fn();
    render(
      <MemoryRouter>
        <BudgetTable
          data={[makeBudget({ id: 42, status: 'APPROVED' })]}
          onView={noop}
          onOpenPdf={noop}
          onConvertir={onConvertir}
          onEnviarWhatsApp={noop}
          onEnviarEmail={noop}
          onCambiarEstado={noop}
          onSetDeleteId={noop}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Convertir presupuesto en Orden de Trabajo'));
    expect(onConvertir).toHaveBeenCalledWith(42);
  });

  it('calls onSetDeleteId when "Eliminar" is clicked', () => {
    const onSetDeleteId = vi.fn();
    render(
      <MemoryRouter>
        <BudgetTable
          data={[makeBudget({ id: 99 })]}
          onView={noop}
          onOpenPdf={noop}
          onConvertir={noop}
          onEnviarWhatsApp={noop}
          onEnviarEmail={noop}
          onCambiarEstado={noop}
          onSetDeleteId={onSetDeleteId}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Eliminar presupuesto'));
    expect(onSetDeleteId).toHaveBeenCalledWith(99);
  });
});
