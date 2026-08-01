import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { WorkOrderListItem } from '../../../types/workOrder';
import PendingMeasurementCards from './PendingMeasurementCards';

const orders: WorkOrderListItem[] = Array.from({ length: 15 }, (_, index) => ({
  id: index + 1,
  number: `A-${String(index + 1).padStart(6, '0')}`,
  status: 'MEASUREMENT',
  client_name: `Cliente ${index + 1}`,
  client_phone: null,
  client_email: null,
  client_address: null,
  material: 'Granito',
  currency: 'ARS',
  total: 1000 + index,
  deposit_received: 0,
  balance_due: 1000 + index,
  delivery_date: `2026-08-${String(index + 1).padStart(2, '0')}`,
}));

describe('PendingMeasurementCards', () => {
  it('renders a 15-item page with pagination information', () => {
    render(
      <MemoryRouter>
        <PendingMeasurementCards
          orders={orders}
          total={20}
          page={1}
          pageSize={15}
          sort="delivery_asc"
          onPageChange={vi.fn()}
          onSortChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('button', { name: /Crear medición para la orden/ })).toHaveLength(15);
    expect(screen.getByText('1–15 de 20 órdenes pendientes')).toBeDefined();
  });

  it('notifies when the order changes', () => {
    const onSortChange = vi.fn();
    render(
      <MemoryRouter>
        <PendingMeasurementCards
          orders={orders}
          total={15}
          page={1}
          pageSize={15}
          sort="delivery_asc"
          onPageChange={vi.fn()}
          onSortChange={onSortChange}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /Ordenar por/ }), {
      target: { value: 'client_asc' },
    });
    expect(onSortChange).toHaveBeenCalledWith('client_asc');
  });
});
