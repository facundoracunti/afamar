import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkOrderCancellationModal from './WorkOrderCancellationModal';

const requirement = {
  id: 7,
  work_order_id: 12,
  work_order_number: 'A-000012',
  pool_id: 3,
  pool_key: 'Johnson|Luxor',
  pool_snapshot: JSON.stringify({ brand: 'Johnson', model: 'Luxor' }),
  required_quantity: 1,
  allocated_quantity: 1,
  pending_quantity: 0,
  recovered_quantity: 0,
  unrecovered_quantity: 0,
  status: 'FULFILLED',
};

describe('WorkOrderCancellationModal', () => {
  it('requires explicit confirmation when the order has payments', () => {
    const onConfirm = vi.fn();
    render(
      <WorkOrderCancellationModal
        open
        orderNumber="A-000012"
        requirements={[requirement]}
        hasRegisteredPayments
        loading={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Confirmar cancelación' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm.hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(
      [{ requirement_id: 7, recovered_quantity: 0 }],
      true,
    );
  });

  it('allows zero recovery without payment confirmation', () => {
    const onConfirm = vi.fn();
    render(
      <WorkOrderCancellationModal
        open
        orderNumber="A-000012"
        requirements={[requirement]}
        hasRegisteredPayments={false}
        loading={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(onConfirm).toHaveBeenCalledWith(
      [{ requirement_id: 7, recovered_quantity: 0 }],
      false,
    );
  });
});
