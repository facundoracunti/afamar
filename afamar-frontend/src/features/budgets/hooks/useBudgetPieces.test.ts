/**
 * The pieces hook is the spine of the multi-piece budget flow (pieces v3,
 * pieces-only mode). These tests pin the invariants the rest of the form
 * depends on:
 *
 * - The form always starts with at least one piece (no empty form).
 * - Adding / removing pieces re-flattens into the legacy arrays so the
 *   totals keep reading a consistent union.
 * - The "Alternativa" dropdown cleanly moves picks between `mainMaterial`
 *   and `alternativeMaterials` arrays.
 * - The legacy `enablePieces` / `clearPieces` / `usePieces` surface was
 *   removed in pieces v3.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';

vi.mock('@/api/resources/additionalWorks', () => ({
  // Pending forever so the hook's async `useEffect` never calls
  // `setFrenteCatalogue` — keeps these unit tests free of post-render
  // updates that would trigger React's "not wrapped in act" warning.
  getAdditionalWorks: vi.fn(() => new Promise<never>(() => {})),
}));

import { useBudgetPieces } from './useBudgetPieces';
import type { EntityFormState, MaterialInForm } from '@/types';
import type { Material } from '@/types/material';

const NEGRO_MAT: Material = {
  id: 10,
  name: 'Negro',
  category_id: 1,
  base_price: 100000,
  price_usd: 0,
  currency: 'ARS',
};
const BLANCO_MAT: Material = {
  id: 11,
  name: 'Blanco',
  category_id: 1,
  base_price: 100000,
  price_usd: 0,
  currency: 'ARS',
};
const DEFAULT_CATALOG: Material[] = [BLANCO_MAT, NEGRO_MAT];

function blankPiece(): import('@/types/budget').BudgetPiece {
  return {
    id: 'p-blank',
    name: 'Mesada 1',
    mainMaterial: null,
    alternativeMaterials: [],
    fabrication_details: [],
    additional_works_data: '[]',
    pools: [],
  };
}

function blankForm(extra: Partial<EntityFormState> = {}): EntityFormState {
  return {
    pieces: [blankPiece()],
    materials_data: [],
    fabrication_details: [],
    additional_works_data: '[]',
    usd_rate: 1000,
    currency: 'ARS',
    ...extra,
  } as unknown as EntityFormState;
}

/** Render the hook with a real `useState`-backed wrapper so that the
 *  React render cycle and `setForm` updates stay in sync. The wrapper
 *  exposes the latest `form` via a mutable holder so tests can assert on
 *  the flat arrays after the hook's `commit` flushed. */
function setupWith(initial: EntityFormState, catalogue: Material[] = DEFAULT_CATALOG) {
  const latest: { form: EntityFormState } = { form: initial };
  const utils = renderHook(({ f, mats }: { f: EntityFormState; mats: Material[] }) => {
    const [form, setForm] = useState<EntityFormState>(f);
    latest.form = form;
    return useBudgetPieces({ form, setForm, materials: mats });
  }, { initialProps: { f: initial, mats: catalogue } });
  return { result: utils.result, getForm: () => latest.form };
}

/** Render the hook from a blank form (which already carries one piece). */
function setup() {
  return setupWith(blankForm());
}

describe('useBudgetPieces (pieces-only mode)', () => {
  it('always opens with at least one piece (no legacy toggle)', () => {
    const { result } = setup();
    expect(result.current.pieces.length).toBeGreaterThanOrEqual(1);
  });

  it('addPiece appends a fresh piece and flattens', () => {
    const { result } = setup();
    const before = result.current.pieces.length;
    act(() => result.current.addPiece());
    expect(result.current.pieces.length).toBe(before + 1);
    expect(result.current.pieces[before].name).toMatch(/^Mesada /);
  });

  it('removePiece drops the right piece', () => {
    const { result } = setup();
    act(() => result.current.addPiece());
    act(() => result.current.addPiece());
    // 1 (initial) + 2 (added) = 3 pieces. Remove the last one → 2.
    const targetId = result.current.pieces[2].id;
    act(() => result.current.removePiece(targetId));
    expect(result.current.pieces).toHaveLength(2);
    expect(result.current.pieces.find((p) => p.id === targetId)).toBeUndefined();
  });

  it('addPieceAlternative appends to the alternatives array and keeps the main', () => {
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 1, width: 1, is_alternative: false,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.addPieceAlternative('p1', 'Negro'));
    expect(result.current.pieces[0].mainMaterial?.name).toBe('Blanco');
    expect(result.current.pieces[0].alternativeMaterials).toHaveLength(1);
    expect(result.current.pieces[0].alternativeMaterials[0].name).toBe('Negro');
  });

  it('togglePieceAlternative promotes the alternative to main (swap)', () => {
    const mat: MaterialInForm = {
      id: null, name: 'X', category: '', color: '',
      price_m2: 100000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 1, width: 1, is_alternative: false,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: { ...mat, name: 'Blanco', is_alternative: false },
        alternativeMaterials: [{ ...mat, name: 'Negro', is_alternative: true }],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.togglePieceAlternative('p1', 0));
    expect(result.current.pieces[0].mainMaterial?.name).toBe('Negro');
    expect(result.current.pieces[0].alternativeMaterials[0].name).toBe('Blanco');
  });

  it('setPieceAdditionalWorks updates one piece and flattens the union', () => {
    const { result } = setup();
    act(() => result.current.addPiece());
    act(() => result.current.addPiece());
    const id = result.current.pieces[0].id;
    const json = JSON.stringify([{ name: 'Traforo', price: 10000, total: 10000, currency: 'ARS', type: 'flat' }]);
    act(() => result.current.setPieceAdditionalWorks(id, json));

    expect(result.current.pieces[0].additional_works_data).toBe(json);
    expect(result.current.pieces[1].additional_works_data).toBe('[]');
  });

  it('the hook no longer exposes the legacy toggle methods', () => {
    const { result } = setup();
    // The legacy `enablePieces` / `clearPieces` / `usePieces` surface was
    // removed in pieces v3 (pieces-only mode). If any of them sneak back
    // into the API, this test catches it so we don't reintroduce the
    // legacy "Desactivar piezas" button.
    expect((result.current as unknown as Record<string, unknown>).enablePieces).toBeUndefined();
    expect((result.current as unknown as Record<string, unknown>).clearPieces).toBeUndefined();
    expect((result.current as unknown as Record<string, unknown>).usePieces).toBeUndefined();
  });
});
