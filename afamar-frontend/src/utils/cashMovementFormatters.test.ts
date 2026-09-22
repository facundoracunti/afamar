import { describe, expect, it } from 'vitest';
import {
  resolveBalanceDue,
  resolveStatus,
  FALLBACK_OT_STATUS,
  type WorkOrdersById,
} from './cashMovementFormatters';
import type { CashMovement } from '../types/cash';
import type { WorkOrderListItem } from '../types/workOrder';

function makeMovement(overrides: Partial<CashMovement> = {}): CashMovement {
  return {
    id: 1,
    type: 'INCOME',
    amount: 100000,
    description: null,
    payment_method: 'EFECTIVO',
    folder_status: null,
    order_id: null,
    order_number: null,
    order_total: null,
    client_name: null,
    expense_type: null,
    remaining_balance: null,
    daily_cash_id: 1,
    created_at: '2026-09-15T10:00:00Z',
    ...overrides,
  };
}

function makeOT(overrides: Partial<WorkOrderListItem> = {}): WorkOrderListItem {
  return {
    id: 88,
    number: 'A-000088',
    status: 'WORKSHOP',
    client_id: 1,
    budget_id: null,
    client_name: 'Juan Pérez',
    client_phone: null,
    client_email: null,
    client_address: null,
    material: 'Negro Brasil',
    currency: 'ARS',
    total: 100000,
    total_usd: 0,
    deposit_received: 30000,
    balance_due: 70000,
    delivery_date: null,
    date: '2026-09-15',
    ...overrides,
  };
}

function makeWoMap(wos: WorkOrderListItem[] = []): WorkOrdersById {
  const map = new Map<number, WorkOrderListItem>();
  for (const wo of wos) map.set(wo.id, wo);
  return map;
}

describe('resolveBalanceDue', () => {
  it('returns null for movements without order_id (generic expenses)', () => {
    expect(resolveBalanceDue(makeMovement(), makeWoMap())).toBeNull();
  });

  it('returns the OT CURRENT balance_due when the OT is in the live cache', () => {
    const wo = makeOT({ balance_due: 12345.67 });
    const m = makeMovement({ order_id: 88 });
    expect(resolveBalanceDue(m, makeWoMap([wo]))).toBe(12345.67);
  });

  it('returns the OT CURRENT balance_due even when the cached snapshot disagrees', () => {
    // The snapshot says 0 but the OT really has $50k pendiente.
    const wo = makeOT({ balance_due: 50000 });
    const m = makeMovement({ order_id: 88, remaining_balance: 0 });
    expect(resolveBalanceDue(m, makeWoMap([wo]))).toBe(50000);
  });

  it('falls back to the movement`s stored remaining_balance when the OT is not in the cache', () => {
    const m = makeMovement({ order_id: 88, remaining_balance: 1234.56 });
    expect(resolveBalanceDue(m, makeWoMap())).toBe(1234.56);
  });

  it('falls back to order_total - amount heuristic when no snapshot is available', () => {
    const m = makeMovement({
      order_id: 88,
      order_total: 100000,
      amount: 30000,
    });
    expect(resolveBalanceDue(m, makeWoMap())).toBe(70000);
  });

  it('clamps the heuristic to >= 0 when amount > order_total', () => {
    const m = makeMovement({
      order_id: 88,
      order_total: 100000,
      amount: 150000, // overpayment
    });
    expect(resolveBalanceDue(m, makeWoMap())).toBe(0);
  });

  it('returns 0 when OT is missing from cache AND no snapshot AND no order_total', () => {
    // The OT exists in the DB but we have zero data about it. Rather than
    // showing `'-` for a valid OT, the helper returns 0 — the real value
    // refreshes on the next reload / query refetch.
    const m = makeMovement({ order_id: 88 });
    expect(resolveBalanceDue(m, makeWoMap())).toBe(0);
  });

  it('treats balance_due = 0 as a valid fully-paid OT (never null)', () => {
    const wo = makeOT({ balance_due: 0 });
    const m = makeMovement({ order_id: 88 });
    expect(resolveBalanceDue(m, makeWoMap([wo]))).toBe(0);
  });
});

describe('resolveStatus', () => {
  it('returns null for movements without order_id', () => {
    expect(resolveStatus(makeMovement(), makeWoMap())).toBeNull();
  });

  it('returns the OT CURRENT status when the OT is in the live cache', () => {
    const wo = makeOT({ status: 'WORKSHOP' });
    const m = makeMovement({ order_id: 88 });
    expect(resolveStatus(m, makeWoMap([wo]))).toBe('WORKSHOP');
  });

  it('returns the OT CURRENT status even when the cached folder_status disagrees', () => {
    const wo = makeOT({ status: 'FINISHED' });
    const m = makeMovement({ order_id: 88, folder_status: 'MEASUREMENT' });
    expect(resolveStatus(m, makeWoMap([wo]))).toBe('FINISHED');
  });

  it('falls back to the movement`s stored folder_status when the OT is not in the cache', () => {
    const m = makeMovement({ order_id: 88, folder_status: 'MEASUREMENT' });
    expect(resolveStatus(m, makeWoMap())).toBe('MEASUREMENT');
  });

  it('returns null when OT is missing from cache AND folder_status is null', () => {
    const m = makeMovement({ order_id: 88 });
    expect(resolveStatus(m, makeWoMap())).toBeNull();
  });
});

describe('Cash table cell mapping integration', () => {
  it('resolves BOTH cells for a movement with a live OT', () => {
    const wo = makeOT({ status: 'WORKSHOP', balance_due: 12345.67 });
    const m = makeMovement({
      order_id: 88,
      amount: 50000,
      order_total: 100000,
      // Legacy snapshot fields are intentionally null / wrong.
      remaining_balance: null,
      folder_status: null,
    });
    const woMap = makeWoMap([wo]);
    expect(resolveBalanceDue(m, woMap)).toBe(12345.67);
    expect(resolveStatus(m, woMap)).toBe('WORKSHOP');
  });

  it('resolves BOTH cells for an OT in MEDICION (Medición)', () => {
    const wo = makeOT({ status: 'MEASUREMENT', balance_due: 80000 });
    const m = makeMovement({ order_id: 88, amount: 20000 });
    const woMap = makeWoMap([wo]);
    expect(resolveStatus(m, woMap)).toBe('MEASUREMENT');
    expect(resolveBalanceDue(m, woMap)).toBe(80000);
  });

  it('resolves BOTH cells for a movement whose OT was deleted (snapshot fallback)', () => {
    const m = makeMovement({
      order_id: 99,
      amount: 30000,
      order_total: 100000,
      remaining_balance: 70000,
      folder_status: 'MEASUREMENT',
    });
    // OT deleted → not in cache → use snapshot.
    expect(resolveBalanceDue(m, makeWoMap())).toBe(70000);
    expect(resolveStatus(m, makeWoMap())).toBe('MEASUREMENT');
  });

  it('exposes the fallback status constant for callers', () => {
    expect(FALLBACK_OT_STATUS).toBe('MEASUREMENT');
  });
});
