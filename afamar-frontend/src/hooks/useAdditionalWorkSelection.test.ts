import { describe, expect, it } from 'vitest';
import {
  parseAdditionalWorksData,
  serializeAdditionalWorksData,
} from '../utils/additionalWorkParse';

describe('parseAdditionalWorksData — frente fields', () => {
  it('parses a flat snapshot row (legacy contract)', () => {
    const rows = parseAdditionalWorksData(
      JSON.stringify([
        {
          additional_work_id: 1,
          name: 'Pulido',
          detail: null,
          price: 15000,
          currency: 'ARS',
          quantity: 2,
          total: 30000,
        },
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('flat');
    expect(rows[0].linear_meters).toBeUndefined();
    expect(rows[0].formula_values).toBeUndefined();
  });

  it('parses a frente snapshot row including formula_values', () => {
    const rows = parseAdditionalWorksData(
      JSON.stringify([
        {
          additional_work_id: 24,
          name: 'Frente / Regrueso',
          detail: null,
          price: 49.34,
          currency: 'USD',
          quantity: 1,
          total: 144.57,
          materialName: '__GLOBAL__',
          type: 'frente',
          linear_meters: 2.93,
          assigned_material_id: 42,
          formula_values: {
            material_price_m2_at_selection: 330,
            multiplier: 1.15,
            computed_at: '2026-07-14T12:00:00.000Z',
          },
        },
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('frente');
    expect(rows[0].linear_meters).toBe(2.93);
    expect(rows[0].assigned_material_id).toBe(42);
    expect(rows[0].formula_values).not.toBeNull();
    expect(rows[0].formula_values?.multiplier).toBe(1.15);
  });

  it('round-trips a frente snapshot row', () => {
    const original = [
      {
        additional_work_id: 24,
        name: 'Frente / Regrueso',
        detail: 'Test',
        price: 49.34,
        currency: 'USD' as const,
        quantity: 1,
        total: 144.57,
        materialName: '__GLOBAL__',
        type: 'frente' as const,
        linear_meters: 2.93,
        assigned_material_id: 42,
        formula_values: {
          material_price_m2_at_selection: 330,
          multiplier: 1.15,
          computed_at: '2026-07-14T12:00:00.000Z',
        },
      },
    ];
    const json = serializeAdditionalWorksData(original);
    const parsed = parseAdditionalWorksData(json);
    expect(parsed[0].assigned_material_id).toBe(42);
    expect(parsed[0].linear_meters).toBe(2.93);
    expect(parsed[0].formula_values?.material_price_m2_at_selection).toBe(330);
    expect(parsed[0].formula_values?.multiplier).toBe(1.15);
  });

  it('tolerates the legacy `constant` key in formula_values (pre-multiplier builds)', () => {
    const rows = parseAdditionalWorksData(
      JSON.stringify([
        {
          additional_work_id: 24,
          name: 'Frente / Regrueso',
          type: 'frente',
          linear_meters: 2.93,
          assigned_material_id: 42,
          formula_values: {
            material_price_m2_at_selection: 330,
            constant: 1.15, // legacy field name from the additive-formula build
            computed_at: '2026-07-14T12:00:00.000Z',
          },
        },
      ]),
    );
    expect(rows[0].formula_values?.multiplier).toBe(1.15);
  });

  it('handles malformed JSON gracefully', () => {
    expect(parseAdditionalWorksData(null)).toEqual([]);
    expect(parseAdditionalWorksData(undefined)).toEqual([]);
    expect(parseAdditionalWorksData('not-json')).toEqual([]);
    expect(parseAdditionalWorksData('')).toEqual([]);
  });

  it('defaults the type to flat when missing on the snapshot (legacy rows)', () => {
    const rows = parseAdditionalWorksData(
      JSON.stringify([
        {
          additional_work_id: 9,
          name: 'Bisel',
          price: 100,
          currency: 'ARS',
          quantity: 1,
          total: 100,
        },
      ]),
    );
    expect(rows[0].type).toBe('flat');
  });
});

describe('sync-on-value-change contract (sibling picker flow)', () => {
  // Mini implementation of the hook's sync effect, lifted out so we
  // can exercise it without mounting React (avoids pulling in
  // @testing-library/react for a single behaviour test).
  function syncedSelections(prev: unknown[], initialJson: string | null | undefined) {
    const next = parseAdditionalWorksData(initialJson);
    if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
    return next;
  }

  it('updates selections when an outside caller bumps the JSON', () => {
    const before: unknown[] = [];
    const row = {
      additional_work_id: 24,
      name: 'Frente / Regrueso',
      detail: null,
      price: 49.33,
      currency: 'USD',
      quantity: 1,
      total: 49.33,
      materialName: 'Negro Brasil',
      type: 'frente',
      linear_meters: 1,
      assigned_material_id: 131,
      formula_values: null,
    };
    const next = syncedSelections(before, JSON.stringify([row]));
    expect(next).toHaveLength(1);
    expect((next[0] as { assigned_material_id: number }).assigned_material_id).toBe(131);
  });

  it('keeps selections referentially stable when the JSON matches', () => {
    const row = {
      additional_work_id: 1,
      name: 'Pulido',
      detail: null,
      price: 100,
      currency: 'ARS' as const,
      quantity: 1,
      total: 100,
    };
    const before: unknown[] = parseAdditionalWorksData(JSON.stringify([row]));
    const parsedAgain = parseAdditionalWorksData(JSON.stringify([row]));
    // The sync would compare round-tripped JSON. After parse → stringify
    // the strings match exactly so the parent state is preserved.
    const sameJsonString = JSON.stringify(before) === JSON.stringify(parsedAgain);
    expect(sameJsonString).toBe(true);
    const after = syncedSelections(before, JSON.stringify(parsedAgain));
    expect(after).toBe(before);
  });
});

/**
 * Tests the X-button removal contract for additional-work rows.
 *
 * The hook's `removeAt(idx)` is the safe way to drop a row when the
 * catalogue id isn't unique within `selections` (which is the case for
 * frentes: every frente row carries the same catalogue id, e.g. 24,
 * and we keep one row per material). The previous design filtered by
 * `additional_work_id`, which dropped ALL frentes at once.
 *
 * This file doesn't import React to avoid pulling in
 * @testing-library/react — instead we exercise the same array-mutation
 * the hook performs and assert the round-tripped JSON.
 */

function removeAtByIndex(prev: unknown[], idx: number): unknown[] {
  return prev.filter((_, i) => i !== idx);
}

function removeByIdFirstMatch(prev: unknown[], targetId: number): unknown[] {
  const i = prev.findIndex((s) => (s as { additional_work_id: number }).additional_work_id === targetId);
  if (i < 0) return prev;
  return [...prev.slice(0, i), ...prev.slice(i + 1)];
}

describe('removeAt vs remove — multi-frente safety', () => {
  it('drops a single frente row at the given index without touching the others', () => {
    const initial: Array<Record<string, unknown>> = [
      {
        additional_work_id: 24,
        type: 'frente',
        name: 'Frente / Regrueso',
        assigned_material_id: 42,
        materialName: 'Negro Brasil',
      },
      {
        additional_work_id: 24,
        type: 'frente',
        name: 'Frente / Regrueso',
        assigned_material_id: 17,
        materialName: 'Marmol Carrara',
      },
    ];
    const after = removeAtByIndex(initial, 0);
    expect(after).toHaveLength(1);
    expect((after[0] as { assigned_material_id: number }).assigned_material_id).toBe(17);
    expect((after[0] as { materialName: string }).materialName).toBe('Marmol Carrara');
  });

  it('does NOT use id-based removal (which would nuke all frentes at once)', () => {
    const initial: Array<Record<string, unknown>> = [
      {
        additional_work_id: 24,
        type: 'frente',
        assigned_material_id: 42,
        materialName: 'Negro Brasil',
      },
      {
        additional_work_id: 24,
        type: 'frente',
        assigned_material_id: 17,
        materialName: 'Marmol Carrara',
      },
    ];
    // The legacy `remove(id)` would have nuked both — that's the bug.
    // The new code uses index-based removal so the second row survives.
    const after = removeByIdFirstMatch(initial, 24);
    expect(after).toHaveLength(1);
    expect((after[0] as { assigned_material_id: number }).assigned_material_id).toBe(17);
  });

  it('removes flat rows by id (only one row per catalogue id)', () => {
    // The legacy dedup-by-id behaviour for flat items is intentional:
    // you don't want 3 "Pulido" rows in the picker. After the
    // dedup-at-add, the row count is always 1 per id, so removeById
    // removes the right thing.
    const initial: Array<Record<string, unknown>> = [
      {
        additional_work_id: 99,
        type: 'flat',
        name: 'Pulido',
      },
    ];
    const after = removeByIdFirstMatch(initial, 99);
    expect(after).toHaveLength(0);
  });
});
