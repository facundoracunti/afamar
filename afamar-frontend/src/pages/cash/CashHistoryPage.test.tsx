import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashHistoryPage from './CashHistoryPage';
import { usePaginatedList } from '../../api/hooks';
import type { CashHistoryItem } from '../../types/cash';

vi.mock('../../api/hooks', () => ({
  usePaginatedList: vi.fn(),
}));

const mockedUsePaginatedList = vi.mocked(usePaginatedList);

function makeCash(overrides: Partial<CashHistoryItem> = {}): CashHistoryItem {
  return {
    id: 7,
    number: 12,
    opened_at: '2026-10-24T09:00:00',
    closed_at: '2026-10-24T18:30:00',
    previous_balance: 100000,
    total_income: 1250000,
    total_expenses: 250000,
    current_balance: 1100000,
    real_cash: 900000,
    notes: 'Cierre verificado',
    movements: [
      {
        id: 31,
        type: 'INCOME',
        amount: 500000,
        description: 'Seña mesada cocina',
        payment_method: 'EFECTIVO',
        order_number: 'A-000031',
        created_at: '2026-10-24T10:15:00',
      },
    ],
    summary: {
      duration_seconds: 34200,
      ingreso_count: 1,
      egreso_count: 0,
      total_by_payment: { EFECTIVO: 500000 },
    },
    ...overrides,
  };
}

function mockHistory(items: CashHistoryItem[]) {
  mockedUsePaginatedList.mockReturnValue({
    items,
    loading: false,
    total: items.length,
    page: 1,
    pageSize: 25,
    setPage: vi.fn(),
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

describe('CashHistoryPage responsive presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one mobile card per closure with all financial values', () => {
    mockHistory([makeCash(), makeCash({ id: 8, number: 11 })]);

    render(<CashHistoryPage />);

    const cards = screen.getAllByTestId('cash-history-mobile-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('#12')).toBeDefined();
    expect(within(cards[0]).getByText('$ 1.250.000,00')).toBeDefined();
    expect(within(cards[0]).getByText('$ 250.000,00')).toBeDefined();
    expect(within(cards[0]).getByText('$ 1.100.000,00')).toBeDefined();
    expect(within(cards[0]).getByText('$ 900.000,00')).toBeDefined();
    expect(within(cards[0]).getByText('Detalle')).toBeDefined();
  });

  it('keeps closure selection and renders the mobile detail movements', () => {
    mockHistory([makeCash()]);

    render(<CashHistoryPage />);

    fireEvent.click(screen.getByTestId('cash-history-mobile-card'));

    expect(screen.getByText('Totales por forma de pago')).toBeDefined();
    expect(screen.getAllByText('EFECTIVO').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('cash-history-mobile-movements')).toBeDefined();
    const movement = screen.getByTestId('cash-history-mobile-movements');
    expect(within(movement).getByText('Seña mesada cocina')).toBeDefined();
    expect(within(movement).getByText('A-000031')).toBeDefined();
    expect(within(movement).getByText('$ 500.000,00')).toBeDefined();
  });

  it('renders the compact empty state without closure or movement tables', () => {
    mockHistory([]);

    render(<CashHistoryPage />);

    expect(screen.getByText('No hay cajas cerradas aún.')).toBeDefined();
    expect(screen.queryByTestId('cash-history-mobile-list')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
