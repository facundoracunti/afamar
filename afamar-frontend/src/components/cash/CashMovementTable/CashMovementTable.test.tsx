import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CashMovementTable } from './CashMovementTable';
import type { CashMovement } from '../../../types/cash';

const movement: CashMovement = {
  id: 7,
  type: 'INCOME',
  amount: 125000,
  order_number: 'A-000007',
  client_name: 'Cliente de prueba',
  payment_method: 'EFECTIVO',
  remaining_balance: 30000,
  created_at: '2026-10-24T10:00:00',
};

const columns = [
  { key: 'order_number', label: 'N° Orden', render: (row: CashMovement) => row.order_number },
  { key: 'client_name', label: 'Cliente', render: (row: CashMovement) => row.client_name },
  { key: 'amount', label: 'Monto', render: (row: CashMovement) => `$ ${row.amount}` },
  { key: 'remaining_balance', label: 'Saldo Restante', render: (row: CashMovement) => `$ ${row.remaining_balance}` },
  { key: 'created_at', label: 'Fecha', render: (row: CashMovement) => row.created_at },
  { key: 'payment_method', label: 'Pago', render: (row: CashMovement) => row.payment_method },
];

describe('CashMovementTable responsive presentation', () => {
  it('reuses every configured field in the mobile card and keeps actions', () => {
    const onAdd = vi.fn();
    const onDelete = vi.fn();
    render(
      <CashMovementTable
        title="Entradas (Ingresos)"
        icon={null}
        titleColor="#16a34a"
        addLabel="Agregar Ingreso"
        emptyMessage="Sin ingresos registrados"
        movements={[movement]}
        columns={columns}
        closed={false}
        onAdd={onAdd}
        onDelete={onDelete}
      />,
    );

    const mobileList = screen.getByLabelText('Entradas (Ingresos) en tarjetas');
    expect(mobileList.textContent).toContain('A-000007');
    expect(mobileList.textContent).toContain('Cliente de prueba');
    expect(mobileList.textContent).toContain('$ 125000');
    expect(mobileList.textContent).toContain('$ 30000');
    expect(mobileList.textContent).toContain('EFECTIVO');
    expect(screen.getByRole('button', { name: 'Agregar Ingreso' })).toBeTruthy();

    const mobileDelete = document.querySelector<HTMLButtonElement>(
      '[aria-label="Eliminar movimiento 7"]',
    );
    expect(mobileDelete).toBeTruthy();
    fireEvent.click(mobileDelete as HTMLButtonElement);
    expect(onDelete).toHaveBeenCalledWith(7);
  });

  it('renders a compact mobile empty state without movement rows', () => {
    const { container } = render(
      <CashMovementTable
        title="Salidas (Egresos)"
        icon={null}
        titleColor="#dc2626"
        addLabel="Agregar Egreso"
        emptyMessage="Sin egresos registrados"
        movements={[]}
        columns={[{ key: 'description', label: 'Concepto', render: () => '—' }]}
        closed={false}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Salidas (Egresos) en tarjetas').textContent).toContain(
      'Sin egresos registrados',
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});
