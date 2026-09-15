/**
 * Render tests for `MeasurementsTable` (the list table on /admin/measurements).
 *
 * Verifies:
 *  - renders one row per measurement
 *  - calls onView when a row is clicked (name/phone/date) — regression
 *  - action buttons do NOT trigger the row onClick (stopPropagation)
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MeasurementsTable } from './MeasurementsTable';
import type { Measurement } from '../../../types/measurement';

const noop = async () => {};

function makeMeasurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    id: 1,
    client_name: 'Juan Pérez',
    client_phone: '+54 11 1234-5678',
    client_address: 'Calle 123',
    scheduled_date: '2026-09-15',
    scheduled_time: '10:00',
    status: 'PENDING',
    ...overrides,
  };
}

interface RenderOpts {
  data?: Measurement[];
  onView?: (id: number) => void;
  onDelete?: (id: number) => void;
  onDone?: (id: number) => void;
}

function renderTable({
  data = [makeMeasurement()],
  onView = vi.fn(),
  onDelete = vi.fn(),
  onDone = vi.fn(),
}: RenderOpts = {}) {
  return render(
    <MeasurementsTable
      visibleRows={data}
      sortField="client_name"
      sortDir="asc"
      dateFilter=""
      dateFilterEnabled={false}
      activeStatus=""
      onSort={noop}
      onView={onView}
      onDelete={onDelete}
      onDone={onDone}
    />,
  );
}

describe('MeasurementsTable', () => {
  it('renders one row per measurement', () => {
    renderTable({
      data: [
        makeMeasurement({ id: 1, client_name: 'Ana' }),
        makeMeasurement({ id: 2, client_name: 'Bruno' }),
      ],
    });
    expect(screen.getByText('Ana')).toBeDefined();
    expect(screen.getByText('Bruno')).toBeDefined();
  });

  it('calls onView when the row (name/phone/date) is clicked', () => {
    const onView = vi.fn();
    renderTable({ onView });

    fireEvent.click(screen.getByText('Juan Pérez'));
    expect(onView).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('+54 11 1234-5678'));
    expect(onView).toHaveBeenCalledWith(1);
  });

  it('does NOT open the view when an action button is clicked', () => {
    const onView = vi.fn();
    const onDelete = vi.fn();
    renderTable({ onView, onDelete, data: [makeMeasurement({ status: 'DONE' })] });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar medición' }));
    expect(onDelete).toHaveBeenCalledWith(1);
    expect(onView).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ver medición' }));
    expect(onView).toHaveBeenCalledWith(1);
  });
});