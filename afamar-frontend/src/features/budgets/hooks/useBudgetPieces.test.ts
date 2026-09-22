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
  // `setFrontCatalogue` — keeps these unit tests free of post-render
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

  it('setPieceMain on an empty piece starts Largo/Ancho at 0 (not 1) — no phantom m²', () => {
    const { result, getForm } = setup();
    act(() => result.current.setPieceMain('p-blank', 'Blanco'));
    expect(result.current.pieces[0].mainMaterial?.name).toBe('Blanco');
    // The operator typed NO measurements yet: the material must not count
    // as 1 m² against the subtotal. Only quantity stays at 1.
    expect(result.current.pieces[0].mainMaterial?.length).toBe(0);
    expect(result.current.pieces[0].mainMaterial?.width).toBe(0);
    expect(result.current.pieces[0].mainMaterial?.quantity).toBe(1);
    // flat materials_data mirrors the same empty dims (totals → 0 m²)
    expect(getForm().materials_data[0]).toMatchObject({ length: 0, width: 0, quantity: 1 });
  });

  it('addPieceAlternative mirrors empty principal dims as 0 (not 1)', () => {
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 0, width: 0, is_alternative: false,
    };
    const { result, getForm } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.addPieceAlternative('p1', 'Negro'));
    const alt = result.current.pieces[0].alternativeMaterials[0];
    expect(alt.name).toBe('Negro');
    // Same empty-dims contract as the principal: 0, not 1 m².
    expect(alt.length).toBe(0);
    expect(alt.width).toBe(0);
    expect(alt.quantity).toBe(1);
    expect(getForm().materials_data.find((m) => m.is_alternative)).toMatchObject({
      length: 0,
      width: 0,
      quantity: 1,
    });
  });

  it('addPieceAlternative still mirrors REAL principal dims (same mesada invariant)', () => {
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 0.5, is_alternative: false,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.addPieceAlternative('p1', 'Negro'));
    const alt = result.current.pieces[0].alternativeMaterials[0];
    expect(alt.length).toBe(2);
    expect(alt.width).toBe(0.5);
    expect(alt.quantity).toBe(1);
  });

  it('MEDITOR flow: snapshots (m2_budgeted etc.) survive updatePieceMain + commit (COMPARATIVA)', () => {
    // A work order converted from a budget carries the budgeted-measurement
    // snapshots on its rows (hydrated by `mapApiToForm` from the flat
    // arrays — see entityFormHelpers.test.ts "COMPARATIVA snapshot
    // hydration"). The operator then corrects the REAL measurement in
    // MEDICIÓN and hits Guardar: `commit` re-derives the flat arrays from
    // the pieces (`flattenPieces`), which MUST keep the budgeted values or
    // the "Presupuestado" column of the agency comparison dies in the PDF.
    const snapshotPiece = {
      id: 'p1', name: 'Mesada 1',
      mainMaterial: {
        id: 10, name: 'Negro', category: '', color: '',
        price_m2: 0, price_m2_usd: 330, currency: 'USD' as const,
        quantity: 1, m2_used: 0, m2_budgeted: 1.76, // budgeted at conversion
        length: 2.75, width: 0.64, is_alternative: false,
      },
      alternativeMaterials: [],
      fabrication_details: [{
        concept: 'Zócalo', detail: 'BASEBOARD', material: 'Negro',
        length: 4, width: 0.105, m2: 0.42, labor: null, currency: 'USD' as const,
        quantity: 1, price: 50,
        m2_budgeted: 0.42, total_ars_budgeted: 50000, total_usd_budgeted: 50,
      }],
      additional_works_data: JSON.stringify([{
        additional_work_id: 88, name: 'Frente Ingletetado 45°',
        currency: 'USD', price: 49.33, quantity: 1, total: 162.79,
        materialName: 'Negro', type: 'frente', linear_meters: 3.3,
        linear_meters_budgeted: 3.3, total_ars_budgeted: 162790, total_usd_budgeted: 162.79,
      }]),
      pools: [],
    };
    const { result, getForm } = setupWith(blankForm({
      pieces: [snapshotPiece],
      materials_data: [{ ...snapshotPiece.mainMaterial, is_alternative: false }],
      fabrication_details: snapshotPiece.fabrication_details,
      additional_works_data: snapshotPiece.additional_works_data,
      currency: 'USD',
    }));

    act(() => result.current.updatePieceMain('p1', 'length', 3));
    expect(result.current.pieces[0].mainMaterial?.length).toBe(3);

    const form = getForm();
    // Real measurement moved (2.75 → 3.0 m)...
    expect(form.materials_data[0].length).toBe(3);
    // ...but the budgeted snapshot survives the commit untouched.
    expect(form.materials_data[0].m2_budgeted).toBe(1.76);
    expect(form.pieces[0].mainMaterial?.m2_budgeted).toBe(1.76);
    expect(form.fabrication_details[0]).toMatchObject({
      m2_budgeted: 0.42, total_ars_budgeted: 50000, total_usd_budgeted: 50,
    });
    const add = JSON.parse(form.additional_works_data || '[]') as Array<Record<string, unknown>>;
    expect(add[0]).toMatchObject({
      linear_meters_budgeted: 3.3, total_ars_budgeted: 162790, total_usd_budgeted: 162.79,
    });
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
    act(() => result.current.togglePieceAlternative('p1', 'Negro'));
    expect(result.current.pieces[0].mainMaterial?.name).toBe('Negro');
    expect(result.current.pieces[0].alternativeMaterials[0].name).toBe('Blanco');
  });

  it('addPieceMainRow appends a tramo with blank dims and flattens it as a non-alternative row', () => {
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 1, width: 1, is_alternative: false,
    };
    const { result, getForm } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.addPieceMainRow('p1', mat));
    expect(result.current.pieces[0].mainMaterialRows).toHaveLength(1);
    // The tramo starts blank (0 dims, quantity 1) so it doesn't silently
    // inflate totals until the operator enters real measurements.
    expect(result.current.pieces[0].mainMaterialRows![0].length).toBe(0);
    expect(result.current.pieces[0].mainMaterialRows![0].quantity).toBe(1);
    // Flatten emits the anchor AND the tramo, both non-alternative.
    expect(getForm().materials_data).toHaveLength(2);
    expect(getForm().materials_data.filter((m) => m.is_alternative)).toHaveLength(0);
    expect(getForm().materials_data.map((m) => m.name)).toEqual(['Blanco', 'Blanco']);
  });

  it('updatePieceMainRow edits ONE tramo without touching the anchor', () => {
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 1, width: 1, is_alternative: false,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat,
        mainMaterialRows: [{ ...mat, length: 0, width: 0 }],
        alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.updatePieceMainRow('p1', 1, 'length', 2.5));
    expect(result.current.pieces[0].mainMaterialRows![0].length).toBe(2.5);
    expect(result.current.pieces[0].mainMaterial?.length).toBe(1);
  });

  it('removePieceMainRow promotes the first tramo when the anchor is removed', () => {
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 1, width: 1, is_alternative: false,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat,
        mainMaterialRows: [
          { ...mat, name: 'Negro', id: NEGRO_MAT.id, price_m2: NEGRO_MAT.base_price, length: 2, width: 0.5 },
          { ...mat, length: 3, width: 0.25 },
        ],
        alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.removePieceMainRow('p1', 0));
    expect(result.current.pieces[0].mainMaterial?.name).toBe('Negro');
    expect(result.current.pieces[0].mainMaterialRows).toHaveLength(1);
    expect(result.current.pieces[0].mainMaterialRows![0].length).toBe(3);
  });

  it('updatePieceMainGroup prices the anchor AND every tramo in one stroke', () => {
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: 100000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 1, width: 1, is_alternative: false,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat,
        mainMaterialRows: [{ ...mat, length: 2, width: 0.5 }],
        alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.updatePieceMainGroup('p1', 'price_m2', 125000));
    expect(result.current.pieces[0].mainMaterial?.price_m2).toBe(125000);
    expect(result.current.pieces[0].mainMaterialRows![0].price_m2).toBe(125000);
  });

  it('swapPieceMain re-identifies the tramos too but keeps their dims', () => {
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: 100000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 1, width: 1, is_alternative: false,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat,
        mainMaterialRows: [{ ...mat, length: 2, width: 0.5 }],
        alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.swapPieceMain('p1', NEGRO_MAT));
    const piece = result.current.pieces[0];
    expect(piece.mainMaterial?.name).toBe('Negro');
    expect(piece.mainMaterialRows![0].name).toBe('Negro');
    // Dims survive the swap.
    expect(piece.mainMaterialRows![0].length).toBe(2);
    expect(piece.mainMaterialRows![0].width).toBe(0.5);
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
