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
import type { AdditionalWorkSelection } from '@/utils/additionalWorkParse';

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
/** USD-priced material used to assert the m² × $/m² price of FRENTE rows
 *  in MATERIALES ADICIONALES (USD 680/m² → 2.70 × 0.15 = 0.405 m² = USD 275.40). */
const MIAMI_MAT: Material = {
  id: 12,
  name: 'Miami',
  category_id: 1,
  base_price: 0,
  price_usd: 680,
  currency: 'USD',
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

  it('removePiece on the LAST piece keeps ONE empty piece PERSISTED in state (no ghost-flicker)', () => {
    // Regression sentinel: deleting the only piece used to empty
    // `form.pieces`, and the render-time fallback (`pieces = form.pieces ||
    // [createEmptyPiece(0)]`) then regenerated a NEW id on every render.
    // That remounted the PieceCard (`key={piece.id}`), refetching the
    // adicionales catalogue → the "Cargando catálogo..." flicker), and made
    // renames map over `[]` (typed names were silently dropped). The
    // invariant must hold AT STATE level (`getForm().pieces`), not just
    // render level: the surviving empty piece is persisted in the same
    // commit, so its id stays stable and renames work on it.
    const { result, getForm } = setup();
    act(() => result.current.removePiece(result.current.pieces[0].id));
    expect(result.current.pieces).toHaveLength(1);
    expect(result.current.pieces[0].mainMaterial).toBeNull();
    expect(result.current.pieces[0].name).toBe('Mesada 1');
    // State, not the render fallback, carries that single piece.
    expect(getForm().pieces).toHaveLength(1);
    expect(getForm().pieces[0].id).toBe(result.current.pieces[0].id);
  });

  it('renamePiece works on the piece left after removing the last one', () => {
    // The flicker bug also broke typing: renames mapped over the EMPTY
    // `form.pieces`, so the operator could never rename the ghost card.
    const { result } = setup();
    act(() => result.current.removePiece(result.current.pieces[0].id));
    const ghostId = result.current.pieces[0].id;
    act(() => result.current.renamePiece(ghostId, 'Mesada Cocina'));
    expect(result.current.pieces[0].name).toBe('Mesada Cocina');
    expect(result.current.pieces[0].id).toBe(ghostId);
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

  it('addPieceAlternative APPENDS N alternatives sequentially (3+ cards, no overwrite)', () => {
    // Regression sentinel: the handler previously RETURNED `next` (a
    // full replace of `alternativeMaterials`), so picking the 2nd
    // alternative overwrote the 1st and a 3rd pick could never survive.
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 0, width: 0, is_alternative: false,
    };
    const { result, getForm } = setupWith(
      blankForm({
        pieces: [{
          id: 'p1', name: 'Mesada 1',
          mainMaterial: mat, alternativeMaterials: [],
          fabrication_details: [], additional_works_data: '[]', pools: [],
        }],
      }),
      [BLANCO_MAT, NEGRO_MAT, MIAMI_MAT],
    );
    act(() => result.current.addPieceAlternative('p1', 'Negro'));
    act(() => result.current.addPieceAlternative('p1', 'Miami'));
    expect(result.current.pieces[0].alternativeMaterials).toHaveLength(2);
    expect(result.current.pieces[0].alternativeMaterials[0].name).toBe('Negro');
    expect(result.current.pieces[0].alternativeMaterials[1].name).toBe('Miami');
    // The main (and its dims) survive every pick.
    expect(result.current.pieces[0].mainMaterial?.name).toBe('Blanco');
    // Flat `materials_data` mirrors ALL alternatives (main + 2 alts).
    const flatAlts = getForm().materials_data.filter((m) => m.is_alternative);
    expect(flatAlts.map((m) => m.name)).toEqual(['Negro', 'Miami']);
  });

  it('addPieceAlternative keeps 3+ alternatives alive together on ONE piece', () => {
    // Same scenario but with a principal that has 2 panes (anchor + tramo):
    // each new alternative must carry its own copy of BOTH panes and never
    // clobber the previous alternative's rows.
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 0.5, is_alternative: false,
    };
    const tramo: MaterialInForm = {
      ...mat, length: 1, width: 0.6, quantity: 1,
    };
    const { result } = setupWith(
      blankForm({
        pieces: [{
          id: 'p1', name: 'Mesada 1',
          mainMaterial: mat,
          mainMaterialRows: [tramo],
          alternativeMaterials: [],
          fabrication_details: [], additional_works_data: '[]', pools: [],
        }],
      }),
      [BLANCO_MAT, NEGRO_MAT, MIAMI_MAT],
    );
    act(() => result.current.addPieceAlternative('p1', 'Negro'));
    act(() => result.current.addPieceAlternative('p1', 'Miami'));
    act(() => result.current.addPieceAlternative('p1', 'Blanco'));
    const alts = result.current.pieces[0].alternativeMaterials;
    expect(alts).toHaveLength(6); // 3 alternatives × 2 panes each
    expect(alts.filter((a) => a.name === 'Negro')).toHaveLength(2);
    expect(alts.filter((a) => a.name === 'Miami')).toHaveLength(2);
    expect(alts.filter((a) => a.name === 'Blanco')).toHaveLength(2);
    // Each alternative keeps the principal's panes (length/width).
    expect(alts.map((a) => `${a.name}:${a.length}x${a.width}`)).toEqual([
      'Negro:2x0.5',
      'Negro:1x0.6',
      'Miami:2x0.5',
      'Miami:1x0.6',
      'Blanco:2x0.5',
      'Blanco:1x0.6',
    ]);
  });

  it('addPieceAlternative with a material already picked is a NO-OP (no duplicate cards)', () => {
    // The picker does not filter already-picked entries; the handler must
    // guard against re-appending the same material (it would produce two
    // cards with the same group key → duplicate React keys).
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: BLANCO_MAT.base_price, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 0, width: 0, is_alternative: false,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }));
    act(() => result.current.addPieceAlternative('p1', 'Negro'));
    act(() => result.current.addPieceAlternative('p1', 'Negro'));
    expect(result.current.pieces[0].alternativeMaterials).toHaveLength(1);
    expect(result.current.pieces[0].alternativeMaterials[0].name).toBe('Negro');
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

  it('updatePieceMainGroup re-prices the piece frentes to the new $/m²', () => {
    // Regression: editing the principal's price (the card's shared price
    // input → `updatePieceMainGroup`) used to leave the `frente` additional
    // works snapshot at the OLD material price — the frente keeps billing
    // the previous $/m². The dynamic refresh re-runs the formula against
    // the new price in the same commit.
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: 100000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: false,
    };
    const alt: MaterialInForm = {
      id: 21, name: 'Marmol', category: '', color: '',
      price_m2: 50000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: true,
    };
    const frente = (materialName: string, id: number | null) => ({
      additional_work_id: 88, name: 'Frente Ingletetado 45°', detail: null,
      price: 100, currency: 'ARS' as const, quantity: 1, total: 200,
      materialName, type: 'frente', linear_meters: 2,
      assigned_material_id: id, formula_values: null,
    });
    const { result, getForm } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat,
        alternativeMaterials: [alt],
        fabrication_details: [],
        additional_works_data: JSON.stringify([
          frente('Blanco', BLANCO_MAT.id),
          frente('Marmol', 21),
        ]),
        pools: [],
      }],
    }));

    act(() => result.current.updatePieceMainGroup('p1', 'price_m2', 200000));

    const add = JSON.parse(result.current.pieces[0].additional_works_data) as AdditionalWorkSelection[];
    // Price formula: 200000 × 0.13 × 1.15 = 29900/ml → × 2 ml = 59800.
    expect(add[0].price).toBe(29900);
    expect(add[0].total).toBe(59800);
    expect(add[0].currency).toBe('ARS');
    expect(add[0].materialName).toBe('Blanco');
    expect(add[0].assigned_material_id).toBe(BLANCO_MAT.id);
    expect(add[0].formula_values?.material_price_m2_at_selection).toBe(200000);
    // The alternative's frente is untouched by a MAIN price edit (and, since
    // it resolves to an alternative material, keeps the `__ALT__:` prefix so
    // the per-option bucketing keeps attributing it to that alternative).
    expect(add[1].price).toBe(7475); // 50000 × 0.13 × 1.15
    expect(add[1].materialName).toBe('__ALT__:Marmol');
    // The flat union mirrors the refreshed snapshot after the commit.
    const flatAdd = JSON.parse(getForm().additional_works_data || '[]') as AdditionalWorkSelection[];
    expect(flatAdd[0].total).toBe(59800);
  });

  it('updatePieceAlternativeGroup re-prices the frentes assigned to that alternative', () => {
    // Same regression on the ALTERNATIVE card: its shared price input
    // (`updatePieceAlternativeGroup`) must refresh the frentes pointing at
    // that material, keeping the `__ALT__:` prefix so the per-option
    // bucketing keeps attributing the total to the alternative.
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: 100000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: false,
    };
    const alt: MaterialInForm = {
      id: 21, name: 'Marmol', category: '', color: '',
      price_m2: 50000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: true,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat,
        alternativeMaterials: [alt],
        fabrication_details: [],
        additional_works_data: JSON.stringify([{
          additional_work_id: 88, name: 'Frente Ingletetado 45°', detail: null,
          price: 100, currency: 'ARS' as const, quantity: 1, total: 200,
          materialName: '__ALT__:Marmol', type: 'frente', linear_meters: 2,
          assigned_material_id: 21, formula_values: null,
        }]),
        pools: [],
      }],
    }));

    act(() => result.current.updatePieceAlternativeGroup('p1', '21', 'price_m2', 90000));

    const add = JSON.parse(result.current.pieces[0].additional_works_data) as AdditionalWorkSelection[];
    expect(add[0].price).toBe(13455); // 90000 × 0.13 × 1.15
    expect(add[0].total).toBe(26910);
    expect(add[0].materialName).toBe('__ALT__:Marmol');
    expect(add[0].assigned_material_id).toBe(21);
  });

  it('a GLOBAL frente survives a price edit untouched (never zeroed, never re-priced)', () => {
    // `POOL_MATERIAL_GLOBAL` rows have no material of their own — the
    // refresh must leave them verbatim (the PDF revalues them per option).
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: 100000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: false,
    };
    const globalRow = {
      additional_work_id: 88, name: 'Frente Doble', detail: null,
      price: 30000, currency: 'ARS' as const, quantity: 1, total: 60000,
      materialName: '__GLOBAL__', type: 'frente', linear_meters: 2,
      assigned_material_id: null, formula_values: null,
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1', mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: JSON.stringify([globalRow]),
        pools: [],
      }],
    }));

    act(() => result.current.updatePieceMainGroup('p1', 'price_m2', 200000));

    const add = JSON.parse(result.current.pieces[0].additional_works_data) as AdditionalWorkSelection[];
    expect(add[0]).toMatchObject(globalRow);
    expect(add[0].price).toBe(30000);
    expect(add[0].assigned_material_id).toBeNull();
  });

  it('a non-price edit does not churn the additional_works_data JSON', () => {
    // `length` is not in FRENTE_PRICE_FIELDS, so the refresh must bail out
    // and return the SAME piece reference (no `computed_at` churn → the
    // commit writes no-op JSON only when the mutation actually changed
    // something else).
    const mat: MaterialInForm = {
      id: BLANCO_MAT.id, name: 'Blanco', category: '', color: '',
      price_m2: 100000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: false,
    };
    const json = JSON.stringify([{
      additional_work_id: 88, name: 'Frente Ingletetado 45°', detail: null,
      price: 14950, currency: 'ARS' as const, quantity: 1, total: 29900,
      materialName: 'Blanco', type: 'frente', linear_meters: 2,
      assigned_material_id: BLANCO_MAT.id,
      formula_values: { material_price_m2_at_selection: 100000, multiplier: 1.15, computed_at: '2026-09-01T00:00:00.000Z' },
    }]);
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1', mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: json, pools: [],
      }],
    }));

    act(() => result.current.updatePieceMain('p1', 'length', 3));
    expect(result.current.pieces[0].mainMaterial?.length).toBe(3);
    // The snapshot JSON stays byte-identical (refresh bailed, no churn).
    expect(result.current.pieces[0].additional_works_data).toBe(json);
  });

  it('frente adicional leaves $0 once dims are set — price = m² × assigned material $/m² (2.70 × 0.15 = 0.405 m²)', () => {
    // A FRENTE in MATERIALES ADICIONALES (a `fabrication_details` row
    // inside the piece card) must be priced from its area × the assigned
    // material's $/m² the moment the operator enters the measurements.
    // Regression: add concepto + select FRENTE + type 2.70 × 0.15 left the
    // price frozen at US$ 0,00 (only `m2` moved, never the price).
    const mat: MaterialInForm = {
      id: MIAMI_MAT.id, name: 'Miami', category: '', color: '',
      price_m2: 0, price_m2_usd: 680, currency: 'USD',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 0.6, is_alternative: false,
    };
    const { result, getForm } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }), [BLANCO_MAT, NEGRO_MAT, MIAMI_MAT]);

    act(() => result.current.addPieceFabrication('p1'));
    act(() => result.current.updatePieceFabrication('p1', 0, 'concept', 'FRONT'));
    act(() => result.current.updatePieceFabrication('p1', 0, 'length', 2.7));
    act(() => result.current.updatePieceFabrication('p1', 0, 'width', 0.15));

    const row = result.current.pieces[0].fabrication_details[0];
    expect(row.concept).toBe('FRONT');
    expect(row.material).toBe('Miami');
    expect(row.currency).toBe('USD');
    expect(row.price).not.toBe(0);
    // 2.70 × 0.15 = 0.405 m² × USD 680/m² = USD 275.40
    expect(row.price).toBeCloseTo(0.405 * 680, 2);
    // The flat union (what the PDF totals) mirrors the same price.
    expect(getForm().fabrication_details[0].price).toBeCloseTo(0.405 * 680, 2);
  });

  it('re-prices a frente adicional immediately when the assigned material changes', () => {
    // Changing "Asignar a opción" (Principal: → another catalogue material)
    // must recompute the m² row at the new $/m² in the new material's
    // currency — never keep the old (or a $0) price.
    const mat: MaterialInForm = {
      id: MIAMI_MAT.id, name: 'Miami', category: '', color: '',
      price_m2: 0, price_m2_usd: 680, currency: 'USD',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 0.6, is_alternative: false,
    };
    const { result, getForm } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: mat, alternativeMaterials: [],
        fabrication_details: [], additional_works_data: '[]', pools: [],
      }],
    }), [BLANCO_MAT, NEGRO_MAT, MIAMI_MAT]);

    act(() => result.current.addPieceFabrication('p1'));
    act(() => result.current.updatePieceFabrication('p1', 0, 'concept', 'FRONT'));
    act(() => result.current.updatePieceFabrication('p1', 0, 'length', 2.7));
    act(() => result.current.updatePieceFabrication('p1', 0, 'width', 0.15));
    // USD 275.40 before the swap, then reassign to the ARS "Negro".
    expect(result.current.pieces[0].fabrication_details[0].price).toBeCloseTo(0.405 * 680, 2);

    act(() => result.current.updatePieceFabrication('p1', 0, 'material', 'Negro'));

    const row = result.current.pieces[0].fabrication_details[0];
    expect(row.material).toBe('Negro');
    expect(row.currency).toBe('ARS');
    // 0.405 m² × ARS 100.000/m² = 40.500
    expect(row.price).toBeCloseTo(0.405 * 100000, 2);
    expect(getForm().fabrication_details[0].price).toBeCloseTo(0.405 * 100000, 2);
  });

  it('swapPieceMain re-prices name-resolved frentes (legacy row without id) to the new price', () => {
    // A legacy frente row (`assigned_material_id: null`, only a name link)
    // must follow a principal swap to the new material's $/m² — resolution
    // falls back to the unprefixed `materialName`.
    const legacyMain: MaterialInForm = {
      id: null, name: 'Blanco', category: '', color: '',
      price_m2: 100000, price_m2_usd: 0, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: false,
    };
    const swappedMat: Material = {
      id: NEGRO_MAT.id,
      name: 'Negro',
      category_id: 1,
      base_price: 150000,
      price_usd: 0,
      currency: 'ARS',
    };
    const { result } = setupWith(blankForm({
      pieces: [{
        id: 'p1', name: 'Mesada 1',
        mainMaterial: legacyMain,
        alternativeMaterials: [],
        fabrication_details: [],
        additional_works_data: JSON.stringify([{
          additional_work_id: 88, name: 'Frente Ingletetado 45°', detail: null,
          price: 14950, currency: 'ARS' as const, quantity: 1, total: 29900,
          materialName: 'Blanco', type: 'frente', linear_meters: 2,
          assigned_material_id: null, formula_values: { material_price_m2_at_selection: 100000, multiplier: 1.15, computed_at: '2026-09-01T00:00:00.000Z' },
        }]),
        pools: [],
      }],
    }));

    act(() => result.current.swapPieceMain('p1', swappedMat));

    const add = JSON.parse(result.current.pieces[0].additional_works_data) as AdditionalWorkSelection[];
    // Repointed by name to the new material + refreshed: 150000 × 0.13 ×
    // 1.15 = 22425/ml → × 2 = 44850.
    expect(add[0].price).toBe(22425);
    expect(add[0].total).toBe(44850);
    expect(add[0].materialName).toBe('Negro');
    expect(add[0].assigned_material_id).toBe(NEGRO_MAT.id);
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
