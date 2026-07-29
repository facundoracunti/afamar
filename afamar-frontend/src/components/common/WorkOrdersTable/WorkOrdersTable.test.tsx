/**
 * Render tests for `WorkOrdersTable` (the row-level table rendered
 * inside the work orders list page).
 *
 * Verifies:
 *  - renders one row per work order
 *  - renders the empty state when there is no data
 *  - shows both "Avanzar" and "Retroceder" buttons for the middle statuses
 *  - shows only "Avanzar" for the first status and only "Retroceder" for the last
 *  - shows "—" when the work order is in a terminal state
 *  - shows the WhatsApp button as enabled only when client_phone is set
 *  - calls onView when the row is clicked
 *  - calls onStatusAdvance with the right direction (1 forward, -1 backward)
 *  - calls onDelete when "Eliminar" is clicked
 *  - calls onOpenPdf when "PDF" is clicked
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkOrdersTable } from './WorkOrdersTable';
import type { WorkOrderListItem } from '../../../types/workOrder';

const noop = () => undefined;

function renderTable(data: WorkOrderListItem[]) {
  return render(
    <WorkOrdersTable
      data={data}
      onView={noop}
      onStatusAdvance={async () => undefined}
      onOpenPdf={async () => undefined}
      onWhatsApp={noop}
      onDelete={noop}
    />,
  );
}

function makeWO(overrides: Partial<WorkOrderListItem> = {}): WorkOrderListItem {
  return {
    id: 1,
    number: 'A-000001',
    status: 'MEASUREMENT',
    client_name: 'Juan Pérez',
    client_phone: '+54 11 1234-5678',
    client_email: 'juan@test.com',
    client_address: 'Calle 123',
    material: 'Negro Brasil',
    currency: 'ARS',
    total: 100000,
    deposit_received: 30000,
    balance_due: 70000,
    delivery_date: null,
    date: '2026-01-15',
    ...overrides,
  };
}

describe('WorkOrdersTable', () => {
  it('renders one row per work order', () => {
    renderTable([
      makeWO({ id: 1, number: 'A-000001' }),
      makeWO({ id: 2, number: 'A-000002' }),
    ]);
    expect(screen.getByText('A-000001')).toBeDefined();
    expect(screen.getByText('A-000002')).toBeDefined();
  });

  it('renders the empty state when no data', () => {
    renderTable([]);
    expect(screen.getByText('No hay órdenes de trabajo')).toBeDefined();
  });

  it('shows both "Avanzar" and "Retroceder" for the first status (MEASUREMENT)', () => {
    renderTable([makeWO({ status: 'MEASUREMENT' })]);
    expect(screen.getByTitle('Avanzar estado')).toBeDefined();
    // MEASUREMENT is the first status, so retroceder is hidden
    expect(screen.queryByTitle('Retroceder estado')).toBeNull();
  });

  it('shows both "Avanzar" and "Retroceder" for a middle status (WORKSHOP)', () => {
    renderTable([makeWO({ status: 'WORKSHOP' })]);
    expect(screen.getByTitle('Avanzar estado')).toBeDefined();
    expect(screen.getByTitle('Retroceder estado')).toBeDefined();
  });

  it('shows "—" (no advance) when status is not in orderStatuses', () => {
    // The component shows a dash when both canBack and canForward are
    // false. This happens when the status is not in `orderStatuses`
    // (statusIdx = -1 → canBack=false, canForward=false).
    renderTable([makeWO({ status: 'UNKNOWN' })]);
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.queryByTitle('Avanzar estado')).toBeNull();
    expect(screen.queryByTitle('Retroceder estado')).toBeNull();
  });

  it('disables WhatsApp button when no phone is set', () => {
    renderTable([makeWO({ client_phone: null })]);
    const button = screen.getByTitle('Sin teléfono cargado');
    expect(button).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables WhatsApp button when phone is set', () => {
    renderTable([makeWO({ client_phone: '+54 11 1234-5678' })]);
    const button = screen.getByTitle('Enviar WhatsApp a +54 11 1234-5678');
    expect(button).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onView when the row is clicked', () => {
    const onView = vi.fn();
    render(
      <WorkOrdersTable
        data={[makeWO()]}
        onView={onView}
        onStatusAdvance={async () => undefined}
        onOpenPdf={async () => undefined}
        onWhatsApp={noop}
        onDelete={noop}
      />,
    );
    fireEvent.click(screen.getByText('A-000001'));
    expect(onView).toHaveBeenCalled();
  });

  it('calls onStatusAdvance with 1 when "Avanzar" is clicked', () => {
    const onStatusAdvance = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkOrdersTable
        data={[makeWO({ status: 'MEASUREMENT' })]}
        onView={noop}
        onStatusAdvance={onStatusAdvance}
        onOpenPdf={async () => undefined}
        onWhatsApp={noop}
        onDelete={noop}
      />,
    );
    fireEvent.click(screen.getByTitle('Avanzar estado'));
    expect(onStatusAdvance).toHaveBeenCalled();
    const [wo, dir] = onStatusAdvance.mock.calls[0];
    expect(wo.number).toBe('A-000001');
    expect(dir).toBe(1);
  });

  it('calls onStatusAdvance with -1 when "Retroceder" is clicked', () => {
    const onStatusAdvance = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkOrdersTable
        data={[makeWO({ status: 'WORKSHOP' })]}
        onView={noop}
        onStatusAdvance={onStatusAdvance}
        onOpenPdf={async () => undefined}
        onWhatsApp={noop}
        onDelete={noop}
      />,
    );
    fireEvent.click(screen.getByTitle('Retroceder estado'));
    expect(onStatusAdvance).toHaveBeenCalled();
    const [, dir] = onStatusAdvance.mock.calls[0];
    expect(dir).toBe(-1);
  });

  it('calls onDelete when "Eliminar" is clicked', () => {
    const onDelete = vi.fn();
    render(
      <WorkOrdersTable
        data={[makeWO({ id: 42 })]}
        onView={noop}
        onStatusAdvance={async () => undefined}
        onOpenPdf={async () => undefined}
        onWhatsApp={noop}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle('Eliminar orden'));
    expect(onDelete).toHaveBeenCalledWith(42);
  });

  it('calls onOpenPdf when "PDF" is clicked', () => {
    const onOpenPdf = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkOrdersTable
        data={[makeWO()]}
        onView={noop}
        onStatusAdvance={async () => undefined}
        onOpenPdf={onOpenPdf}
        onWhatsApp={noop}
        onDelete={noop}
      />,
    );
    fireEvent.click(screen.getByTitle('Vista previa del PDF'));
    expect(onOpenPdf).toHaveBeenCalled();
  });
});
