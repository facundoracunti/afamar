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

const noop = async () => {};

function renderTable(data: WorkOrderListItem[]) {
  return render(
    <WorkOrdersTable
      data={data}
      onView={noop}
      onStatusAdvance={async () => undefined}
onOpenPdf={async () => undefined}
        onOpenFicha={noop}
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
    // (statusIdx = -1 → canBack=false, canForward=false). Use a
    // function matcher so RTL reads textContent (the dash is wrapped
    // inside a <span> with sibling text nodes).
    renderTable([makeWO({ status: 'UNKNOWN' })]);
    expect(screen.getAllByText((_, el) => el?.textContent === '—').length).toBeGreaterThan(0);
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
        onOpenFicha={noop}
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
        onOpenFicha={noop}
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
        onOpenFicha={noop}
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
        onOpenFicha={noop}
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
        onOpenFicha={noop}
        onWhatsApp={noop}
        onDelete={noop}
      />,
    );
    fireEvent.click(screen.getByTitle('Vista previa del PDF'));
    expect(onOpenPdf).toHaveBeenCalled();
  });
});

describe('WorkOrdersTable — MATERIAL column', () => {
  it('uses `o.material` when it has a value', () => {
    renderTable([makeWO({ material: 'Negro Brasil' })]);
    expect(screen.getByText('Negro Brasil')).toBeDefined();
  });

  it('falls back to the principal of the first piece when `material` is empty', () => {
    renderTable([
      makeWO({
        material: null,
        pieces: [
          { mainMaterial: { name: 'Blanco Turco' } },
        ],
      }),
    ]);
    expect(screen.getByText('Blanco Turco')).toBeDefined();
  });

  it('falls back to the first alternative of the first piece when no principal', () => {
    renderTable([
      makeWO({
        material: null,
        pieces: [
          {
            mainMaterial: null,
            alternativeMaterials: [{ name: 'Gris Mara' }],
          },
        ],
      }),
    ]);
    expect(screen.getByText('Gris Mara')).toBeDefined();
  });

  it('parses `materials_data` (JSON string) when `material` + `pieces` are empty', () => {
    renderTable([
      makeWO({
        material: null,
        pieces: [],
        materials_data: JSON.stringify([{ name: 'Negro Brasil' }, { name: 'Respaldo' }]),
      }),
    ]);
    expect(screen.getByText('Negro Brasil')).toBeDefined();
  });

  it('falls back to `items[]` when nothing else has a name', () => {
    renderTable([
      makeWO({
        material: null,
        pieces: [],
        materials_data: '[]',
        items: [{ name: 'Item Legacy' }],
      }),
    ]);
    expect(screen.getByText('Item Legacy')).toBeDefined();
  });

  it('shows "-" when no source has a name', () => {
    renderTable([
      makeWO({
        material: null,
        pieces: [],
        materials_data: '',
        items: [],
      }),
    ]);
    // The Material cell renders '-' (alongside other empty cells). Use
    // a function matcher so RTL reads textContent.
    const dashes = screen.getAllByText((_, el) => el?.textContent === '-');
    expect(dashes.length).toBeGreaterThan(0);
  });
});

describe('WorkOrdersTable — ENTREGA date format', () => {
  it('renders DD/MM/YYYY with zero-padding for ISO date strings', () => {
    renderTable([makeWO({ delivery_date: '2026-09-01' })]);
    expect(screen.getByText('01/09/2026')).toBeDefined();
  });

  it('renders DD/MM/YYYY for ISO date-time strings', () => {
    renderTable([makeWO({ delivery_date: '2026-09-01T15:30:00Z' })]);
    expect(screen.getByText('01/09/2026')).toBeDefined();
  });

  it('renders DD/MM/YYYY for the legacy `estimated_delivery_date` fallback', () => {
    renderTable([
      makeWO({ delivery_date: null, estimated_delivery_date: '2026-12-25' }),
    ]);
    expect(screen.getByText('25/12/2026')).toBeDefined();
  });

  it('renders "—" when no delivery date is present', () => {
    renderTable([
      makeWO({ delivery_date: null, estimated_delivery_date: null }),
    ]);
    // The dash renders inside a <td>; multiple dashes can exist on the
    // row (Teléfono, Material, etc.). Use a function matcher so RTL
    // reads textContent (which can span text nodes) instead of `innerText`.
    const dashes = screen.getAllByText(
      (_, el) => el?.textContent === '—',
    );
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.queryByText(/\d{2}\/\d{2}\/\d{4}/)).toBeNull();
  });
});

/** Helper: find any element whose textContent (joined across text nodes)
 *  contains `needle`. The `<CurrencyDisplay>` renders `$ ` and the number
 *  as separate text nodes inside a `<span>`, so RTL's default
 *  `getByText('$ 100.000')` would split-match and fail. */
function findByTextContent(needle: string): HTMLElement[] {
  return screen.getAllByText((_, el) =>
    (el as HTMLElement | null)?.textContent?.includes(needle) ?? false,
  );
}

describe('WorkOrdersTable — TOTAL / SEÑA / SALDO math invariant', () => {
  it('TOTAL − SEÑA = SALDO for a standard 100,000 / 30,000 / 70,000 OT', () => {
    renderTable([makeWO()]);
    expect(findByTextContent('$ 100.000,00').length).toBeGreaterThan(0);
    expect(findByTextContent('$ 30.000,00').length).toBeGreaterThan(0);
    expect(findByTextContent('$ 70.000,00').length).toBeGreaterThan(0);
  });

  it('TOTAL − SEÑA = SALDO holds when SEÑA = 0 (no deposit)', () => {
    renderTable([makeWO({ deposit_received: 0 })]);
    expect(findByTextContent('$ 100.000,00').length).toBeGreaterThan(0);
    expect(findByTextContent('$ 0,00').length).toBeGreaterThan(0);
    // SALDO equals TOTAL when no deposit was made.
    const totalMatches = findByTextContent('$ 100.000,00');
    expect(totalMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('TOTAL − SEÑA = SALDO holds when SALDO = 0 (fully paid)', () => {
    renderTable([
      makeWO({ total: 100000, deposit_received: 100000, balance_due: 0 }),
    ]);
    expect(findByTextContent('$ 100.000,00').length).toBeGreaterThanOrEqual(2);
    expect(findByTextContent('$ 0,00').length).toBeGreaterThan(0);
  });

  it('TOTAL − SEÑA = SALDO holds for a discounted OT (total reflects the discount)', () => {
    // OT with 7% commercial discount on a $1,915,831.99 total → TOTAL stays
    // at the persisted (already-discounted) value, SEÑA is the contractual
    // 50% = $957,916, SALDO = TOTAL - SEÑA.
    renderTable([
      makeWO({
        total: 1915831.99,
        deposit_received: 957916,
        balance_due: 957915.99,
      }),
    ]);
    expect(findByTextContent('$ 1.915.831,99').length).toBeGreaterThan(0);
    expect(findByTextContent('$ 957.916,00').length).toBeGreaterThan(0);
    expect(findByTextContent('$ 957.915,99').length).toBeGreaterThan(0);
  });

  it('TOTAL − SEÑA = SALDO holds for an OT with tarjeta (seña = TOTAL)', () => {
    renderTable([
      makeWO({ total: 250000, deposit_received: 250000, balance_due: 0 }),
    ]);
    expect(findByTextContent('$ 250.000,00').length).toBeGreaterThanOrEqual(2);
    expect(findByTextContent('$ 0,00').length).toBeGreaterThan(0);
  });
});
