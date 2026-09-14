import { describe, expect, it } from 'vitest';
import type { Measurement } from '../types/measurement';
import { computeScheduledWorkOrderIds, countMeasurementStatuses } from './measurementHelpers';

const base: Measurement = {
  id: 1,
  client_name: 'Cliente',
  status: 'PENDING',
  scheduled_date: '2026-09-10',
};

describe('computeScheduledWorkOrderIds', () => {
  it('returns the work-order id of every non-cancelled measurement', () => {
    const measurements: Measurement[] = [
      { ...base, id: 1, work_order_id: 11, status: 'PENDING' },
      { ...base, id: 2, work_order_id: 12, status: 'DONE' },
    ];
    expect(computeScheduledWorkOrderIds(measurements)).toEqual(new Set([11, 12]));
  });

  it('skips CANCELLED measurements (the pending card must stay)', () => {
    const measurements: Measurement[] = [
      { ...base, id: 1, work_order_id: 11, status: 'CANCELLED' },
      { ...base, id: 2, work_order_id: 12, status: 'PENDING' },
    ];
    expect(computeScheduledWorkOrderIds(measurements)).toEqual(new Set([12]));
  });

  it('hides the card even when the visit is scheduled for another day', () => {
    // Regression: the pending cards previously used the agenda's date-filtered
    // list, so a visit scheduled for a non-today date was invisible and the
    // work order stayed in "Órdenes pendientes de medición" forever.
    const measurements: Measurement[] = [
      { ...base, id: 1, work_order_id: 99, status: 'PENDING', scheduled_date: '2027-03-15' },
    ];
    expect(computeScheduledWorkOrderIds(measurements)).toEqual(new Set([99]));
  });

  it('ignores measurements without a linked work order and empty input', () => {
    expect(computeScheduledWorkOrderIds([{ ...base, id: 1, work_order_id: null }])).toEqual(new Set());
    expect(computeScheduledWorkOrderIds([])).toEqual(new Set());
  });
});

describe('countMeasurementStatuses', () => {
  it('counts rows per status', () => {
    const measurements: Measurement[] = [
      { ...base, id: 1, status: 'PENDING' },
      { ...base, id: 2, status: 'PENDING' },
      { ...base, id: 3, status: 'DONE' },
      { ...base, id: 4, status: 'CANCELLED' },
    ];
    expect(countMeasurementStatuses(measurements)).toEqual({ PENDING: 2, DONE: 1, CANCELLED: 1 });
  });

  it('falls back to PENDING for empty or unknown statuses', () => {
    const measurements: Measurement[] = [
      { ...base, id: 1, status: '' },
      { ...base, id: 2, status: null as unknown as string },
      { ...base, id: 3, status: 'OTHER' },
    ];
    expect(countMeasurementStatuses(measurements)).toEqual({ PENDING: 2, DONE: 0, CANCELLED: 0, OTHER: 1 });
  });

  it('returns zeros for an empty input', () => {
    expect(countMeasurementStatuses([])).toEqual({ PENDING: 0, DONE: 0, CANCELLED: 0 });
  });
});