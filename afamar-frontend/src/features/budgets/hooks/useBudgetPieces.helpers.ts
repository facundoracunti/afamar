/**
 * Pure mutation helpers for the pieces-flow (`useBudgetPieces`). Each
 * `mutate*` function applies ONE operation to a single piece and returns a
 * NEW piece (immutably) — the hook's `commit` wrapper is responsible for
 * the `id` guard, array mapping and flat re-derivation. Keeping them pure
 * (no React, no state) lets the hook stay a thin orchestrator and the whole
 * CRUD logic be unit-tested in isolation.
 *
 * Blocked invariants preserved from the original single-file hook:
 * - "same mesada, different material": alternatives mirror the principal's
 *   length/width/quantity.
 * - Append, never replace, for alternatives (each new pick adds a slot;
 *   re-picking an already-present material is a no-op via `groupKeyOf`).
 * - Dim edits on the principal mirror into the alternatives; $/m² or
 *   currency edits re-price the piece's `frente` additional works via
 *   `refreshPieceFrentes` (see `FRENTE_PRICE_FIELDS`).
 */
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type {
  BudgetPiece,
  FabricationDetail,
  MaterialInForm,
  PoolInForm,
} from '@/types/budget';
import { POOL_MATERIAL_GLOBAL } from '@/types/budget';
import type { AdditionalWork } from '@/types/additionalWork';
import { addMaterialToList, repointSwapReferences } from '@/hooks/entityFormHelpers';
import { recomputeFabricationRow } from '@features/budgets/utils/fabricationDetails';
import { M2_CONCEPTS } from '@/hooks/entityFormConstants';
import type { AdditionalWorkSelection } from '@/utils/additionalWorkParse';
import { parseAdditionalWorksData, serializeAdditionalWorksData } from '@/utils/additionalWorkParse';
import {
  buildFrenteMaterialOptions,
  computeFrenteTotal,
  resolveFrenteMultiplier,
} from '@/utils/frentePricing';

/** Stable key that groups rows of the same alternative card together.
 *  Prefers the catalog `id` (numeric, unique) and falls back to `name`
 *  for legacy rows where `id` is null. Two rows that share this key
 *  belong to the same alternative material. */
export function groupKeyOf(alt: MaterialInForm): string {
  return String(alt.id ?? alt.name);
}

export function pieceMainPrices(piece: BudgetPiece): { ars: number; usd: number } {
  const main = piece.mainMaterial;
  if (!main) return { ars: 0, usd: 0 };
  return { ars: Number(main.price_m2) || 0, usd: Number(main.price_m2_usd) || 0 };
}

/**
 * Capture the dims of the principal material so they can be propagated
 * onto a freshly-picked main AND every alternative. This is the
 * "same mesada, different material" invariant — alternatives mirror
 * the principal's length/width/quantity.
 *
 * Length/width default to 0 (not 1): a material added without real
 * measurements must NOT count as 1 m² against the subtotal — the
 * operator types the real dims. Only `quantity` keeps a neutral 1.
 */
export function pieceDims(piece: BudgetPiece): { length: number; width: number; quantity: number } {
  const m = piece.mainMaterial;
  if (m) {
    return {
      length: Number(m.length) || 0,
      width: Number(m.width) || 0,
      quantity: Number(m.quantity) || 1,
    };
  }
  return { length: 0, width: 0, quantity: 1 };
}

/** Fields on a material whose edit changes the $/m² the frente formula
 *  derives from. Editing any of these must re-price the piece's `frente`
 *  additional works (see `refreshPieceFrentes`) or the snapshot stays at
 *  the previous material's price. */
export const FRENTE_PRICE_FIELDS: ReadonlySet<string> = new Set([
  'price_m2',
  'price_m2_usd',
  'currency',
]);

/**
 * Re-price every m²-based fabrication row (BASEBOARD, FRONT — see
 * `M2_CONCEPTS`) assigned to the passed material against its CURRENT
 * $/m². Mirrors `refreshPieceFrentes` (which re-prices the
 * `additional_works_data` frentes for the same material edit) so the FORM
 * keeps both the additional works AND the manual fabrication rows in sync
 * with the material's current price.
 *
 * Why this exists: `mutateUpdatePieceMainGroup` and
 * `mutateUpdatePieceAlternativeGroup` already re-price the frentes via
 * `refreshPieceFrentes`, but they left the FORM's `fabrication_details`
 * (zócalos / frentes manuales) frozen at the OLD material's price — the
 * operator saw the new price on the principal and a stale subtotal on
 * each linked zócalo until they edited the zócalo's `length` / `width`.
 * The PDF had a `price:0 → material_price_m2` fallback but it only
 * triggers for rows that ALREADY had `price:0`; rows whose `price` was
 * captured at creation (e.g. `0.42 m² × 220 ARS/m² = 92.40 ARS`) kept
 * that value forever.
 *
 * Behaviour:
 *   - Rows whose `concept` is NOT in `M2_CONCEPTS` are left untouched
 *     (TRAFORO / CUTOUT etc. carry an operator-set price).
 *   - Rows whose `material` does NOT match the passed material's name
 *     are left untouched (they belong to another piece / option / GLOBAL).
 *   - Rows with `length:0` / `width:0` only get the snapshot
 *     (`material_price_m2` + `currency`) updated so the PDF's `price:0`
 *     fallback stays consistent — they don't get a price until the
 *     operator types dims (mirrors `addDetalle`).
 *   - Rows with real dims get `price = m² × $/m²` recomputed against the
 *     CURRENT material price (NOT the captured `material_price_m2`).
 *
 * Returns the SAME array reference when nothing changed so the downstream
 * `commit` doesn't write a no-op JSON.
 */
export function refreshPieceFabricationDetails(
  fabrications: FabricationDetail[],
  material: MaterialInForm | null | undefined,
): FabricationDetail[] {
  if (!material) return fabrications;
  const materialName = (material.name || '').trim();
  if (!materialName) return fabrications;
  const isUsd = material.currency === 'USD';
  const newPricePerM2 = isUsd
    ? Number(material.price_m2_usd) || 0
    : Number(material.price_m2) || 0;
  const newCurrency: 'ARS' | 'USD' = isUsd ? 'USD' : 'ARS';

  let changed = false;
  const next = fabrications.map((d) => {
    if (!M2_CONCEPTS.includes(String(d.concept || ''))) return d;
    if ((d.material || '').trim() !== materialName) return d;

    const length = Number(d.length || 0);
    const width = Number(d.width || 0);
    const quantity = Number(d.quantity || 1);

    // Always sync the snapshot fields so the PDF's `price:0` fallback
    // (and `total_*_budgeted` migrations) stay consistent with the new
    // material price — even when the row has no dims yet.
    const baseUpdate: FabricationDetail = {
      ...d,
      material_price_m2: newPricePerM2,
      currency: newCurrency,
    };

    if (length <= 0 || width <= 0) {
      if (
        baseUpdate.material_price_m2 !== d.material_price_m2 ||
        baseUpdate.currency !== d.currency
      ) {
        changed = true;
        return baseUpdate;
      }
      return d;
    }

    const newM2 = length * width * quantity;
    const newPrice = Math.round(newM2 * newPricePerM2 * 100) / 100;
    const newM2Label = Number(newM2.toFixed(2));
    if (
      baseUpdate.material_price_m2 !== d.material_price_m2 ||
      baseUpdate.currency !== d.currency ||
      newPrice !== d.price ||
      newM2Label !== d.m2
    ) {
      changed = true;
      return { ...baseUpdate, m2: newM2Label, price: newPrice };
    }
    return d;
  });
  return changed ? next : fabrications;
}

/**
 * Dynamic refresh of a piece's `frente` additional works after a material
 * identity/price change on the SAME piece (principal pick, price/currency
 * edit, swap to another material). Every frente row that resolves to a
 * material is re-priced against that material's CURRENT $/m² and currency.
 *
 * Resolution: by `assigned_material_id` first (catalogue id), falling back
 * to the unprefixed `materialName` for legacy rows whose id was not
 * captured. Rows that resolve to NO material (GLOBAL, or assigned to a
 * material that no longer exists on the piece) are left untouched — never
 * zeroed (unlike `recomputeFrenteRow`, which would null the price when the
 * id is null). Returns the same piece reference when nothing changed so the
 * downstream `commit` doesn't write a no-op JSON.
 */
function refreshPieceFrentes(
  piece: BudgetPiece,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  const rows = parseAdditionalWorksData(piece.additional_works_data);
  if (rows.length === 0) return piece;

  const pieceMaterials: MaterialInForm[] = [
    piece.mainMaterial,
    ...(piece.mainMaterialRows || []),
    ...(piece.alternativeMaterials || []),
  ].filter(Boolean) as MaterialInForm[];
  const materialOptions = buildFrenteMaterialOptions({ materials: pieceMaterials });
  if (materialOptions.length === 0) return piece;

  const unprefix = (name: string) =>
    name.startsWith('__ALT__:') ? name.slice('__ALT__:'.length) : name;

  let changed = false;
  const nextRows = rows.map((row) => {
    if (row.type !== 'frente') return row;
    const isGlobal =
      row.materialName === POOL_MATERIAL_GLOBAL && row.assigned_material_id == null;
    if (isGlobal) return row;
    const byId =
      row.assigned_material_id != null
        ? materialOptions.find((m) => m.id === row.assigned_material_id)
        : undefined;
    const byName =
      !byId && row.materialName
        ? materialOptions.find((m) => m.name === unprefix(row.materialName as string))
        : undefined;
    const opt = byId ?? byName;
    // Unresolvable — keep the row verbatim rather than zeroing it.
    if (!opt) return row;

    const catalogueItem = catalogueById.get(Number(row.additional_work_id));
    const multiplier = resolveFrenteMultiplier(catalogueItem);
    const computed = computeFrenteTotal(
      opt.price_per_m2,
      multiplier,
      Number(row.linear_meters || 0),
    );

    const updated: AdditionalWorkSelection = {
      ...row,
      price: computed.price_per_meter,
      total: computed.total,
      currency: opt.currency,
      materialName: opt.is_alternative ? `__ALT__:${opt.name}` : opt.name,
      assigned_material_id: opt.id,
      formula_values: {
        material_price_m2_at_selection: opt.price_per_m2,
        multiplier,
        computed_at: new Date().toISOString(),
      },
    };
    // Only adopt the recomputation when something actually moved — avoid
    // churning `computed_at` (and the JSON) on every unrelated commit.
    if (
      updated.price === row.price &&
      updated.total === row.total &&
      updated.currency === row.currency &&
      updated.assigned_material_id === row.assigned_material_id &&
      updated.materialName === row.materialName
    ) {
      return row;
    }
    changed = true;
    return updated;
  });

  if (!changed) return piece;
  return { ...piece, additional_works_data: serializeAdditionalWorksData(nextRows) };
}

// ---------------------------------------------------------------------------
// Piece-level CRUD (each op receives the ALREADY-matched piece)
// ---------------------------------------------------------------------------

export function mutateSetPieceMain(
  piece: BudgetPiece,
  form: EntityFormState,
  materials: Material[],
  name: string,
): BudgetPiece {
  const seed = piece.mainMaterial ? [piece.mainMaterial] : [];
  const dims = pieceDims(piece);
  const list = addMaterialToList(
    { ...form, materials_data: seed },
    materials,
    name,
  );
  const newMain = list && list.length > 0
    ? { ...list[0], ...dims, is_alternative: false }
    : piece.mainMaterial;
  const alternativeMaterials = piece.alternativeMaterials.map((a) => ({
    ...a,
    ...dims,
  }));
  return { ...piece, mainMaterial: newMain, alternativeMaterials };
}

export function mutateUpdatePieceMain(
  piece: BudgetPiece,
  field: string,
  value: unknown,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  if (!piece.mainMaterial) return piece;
  const mainMaterial = {
    ...piece.mainMaterial,
    [field]: value,
  } as MaterialInForm;
  const isDim = field === 'length' || field === 'width' || field === 'quantity';
  const alternativeMaterials = isDim
    ? piece.alternativeMaterials.map((a) => ({ ...a, [field]: value }))
    : piece.alternativeMaterials;
  const base = { ...piece, mainMaterial, alternativeMaterials };
  // $/m² or currency edit → re-price the piece's frentes against the
  // new price (see `refreshPieceFrentes`).
  return FRENTE_PRICE_FIELDS.has(field)
    ? refreshPieceFrentes(base, catalogueById)
    : base;
}

export function mutateSwapPieceMain(
  piece: BudgetPiece,
  form: EntityFormState,
  mat: Material,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  if (!piece.mainMaterial) return piece;
  const oldName = piece.mainMaterial.name;
  const newMain: MaterialInForm = {
    ...piece.mainMaterial,
    id: mat.id ?? null,
    name: mat.name,
    category: '',
    color: mat.color || '',
    price_m2: Number(mat.base_price) || 0,
    price_m2_usd: Number(mat.price_usd) || 0,
    currency: (mat.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD',
    is_alternative: false,
  };
  // Tramos are panes of the same physical material — re-identify
  // them too (name/color/prices/currency) but keep each row's dims.
  const mainMaterialRows = (piece.mainMaterialRows || []).map((row) => ({
    ...row,
    id: mat.id ?? null,
    name: mat.name,
    category: '',
    color: mat.color || '',
    price_m2: Number(mat.base_price) || 0,
    price_m2_usd: Number(mat.price_usd) || 0,
    currency: (mat.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD',
    is_alternative: false,
  }));
  const dims = pieceDims(piece);
  const alternativeMaterials = piece.alternativeMaterials.map((a) => ({
    ...a,
    ...dims,
  }));
  if (oldName === mat.name) {
    return { ...piece, mainMaterial: newMain, mainMaterialRows, alternativeMaterials };
  }
  const synth: EntityFormState = {
    ...form,
    materials_data: [piece.mainMaterial, ...mainMaterialRows],
    fabrication_details: piece.fabrication_details,
    additional_works_data: piece.additional_works_data,
    pools_data: [],
  };
  const refs = repointSwapReferences(
    synth,
    new Set([oldName].filter(Boolean) as string[]),
    mat.name,
    { mat, catalogueById },
  );
  const base: BudgetPiece = {
    ...piece,
    mainMaterial: newMain,
    mainMaterialRows,
    alternativeMaterials,
    fabrication_details: refs.fabrication_details,
    additional_works_data: refs.additional_works_data ?? '[]',
  };
  // Safety net: re-price frentes that are assigned by catalogue id
  // (their `materialName` may not equal `oldName`, so the
  // name-based repoint above left them at the old material price).
  return refreshPieceFrentes(base, catalogueById);
}

export function mutateRemovePieceMain(piece: BudgetPiece): BudgetPiece {
  return { ...piece, mainMaterial: null, mainMaterialRows: [] };
}

export function mutateAddPieceMainRow(
  piece: BudgetPiece,
  mat: MaterialInForm,
): BudgetPiece {
  if (!piece.mainMaterial) return piece;
  const seed = piece.mainMaterial;
  const tramo: MaterialInForm = {
    ...(mat && mat.name ? mat : seed),
    quantity: 1,
    m2_used: 0,
    m2_budgeted: 0,
    length: 0,
    width: 0,
    is_alternative: false,
  };
  // Strictly LOCAL — does NOT mirror the new pane into the
  // alternatives. Each alternative owns its own rows.
  return {
    ...piece,
    mainMaterialRows: [...(piece.mainMaterialRows || []), tramo],
  };
}

export function mutateUpdatePieceMainRow(
  piece: BudgetPiece,
  idx: number,
  field: string,
  value: unknown,
): BudgetPiece {
  const rows = piece.mainMaterialRows || [];
  // idx 0 = the anchor (`mainMaterial`), idx ≥ 1 = a tramo.
  if (idx === 0) {
    if (!piece.mainMaterial) return piece;
    return {
      ...piece,
      mainMaterial: { ...piece.mainMaterial, [field]: value } as MaterialInForm,
    };
  }
  const list = [...rows];
  if (idx - 1 < 0 || idx - 1 >= list.length) return piece;
  list[idx - 1] = { ...list[idx - 1], [field]: value } as MaterialInForm;
  return { ...piece, mainMaterialRows: list };
}

export function mutateRemovePieceMainRow(
  piece: BudgetPiece,
  idx: number,
): BudgetPiece {
  const rows = piece.mainMaterialRows || [];
  let nextMain: MaterialInForm | null = piece.mainMaterial;
  let nextRows: MaterialInForm[] = rows;
  if (idx === 0) {
    // Removing the anchor: promote the first tramo so the piece
    // never ends with rows but no main.
    if (rows.length === 0) {
      nextMain = null;
    } else {
      nextMain = { ...rows[0], is_alternative: false };
      nextRows = rows.slice(1);
    }
  } else {
    nextRows = rows.filter((_, i) => i !== idx - 1);
  }
  // Strictly LOCAL — alternatives keep their own rows even
  // when the principal loses a pane.
  return {
    ...piece,
    mainMaterial: nextMain,
    mainMaterialRows: nextRows,
  };
}

export function mutateUpdatePieceMainGroup(
  piece: BudgetPiece,
  field: string,
  value: unknown,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  if (!piece.mainMaterial) return piece;
  const updatedMain = { ...piece.mainMaterial, [field]: value } as MaterialInForm;
  const base = {
    ...piece,
    mainMaterial: updatedMain,
    mainMaterialRows: (piece.mainMaterialRows || []).map((row) => ({
      ...row,
      [field]: value,
    })),
  };
  // Price / currency edits affect EVERY row whose `material` matches the
  // principal's name — frentes (additional_works_data) re-price via
  // `refreshPieceFrentes`; m² fabrication rows (fabrication_details)
  // re-price via `refreshPieceFabricationDetails`. Without this call
  // zócalos captured `material_price_m2` at creation time and stayed
  // frozen at the OLD subtotal even after the operator typed a new
  // price in the principal card's shared input.
  const nextFabrications = FRENTE_PRICE_FIELDS.has(field)
    ? refreshPieceFabricationDetails(piece.fabrication_details, updatedMain)
    : piece.fabrication_details;
  const pieceWithFab = { ...base, fabrication_details: nextFabrications };
  const result = FRENTE_PRICE_FIELDS.has(field)
    ? refreshPieceFrentes(pieceWithFab, catalogueById)
    : pieceWithFab;
  return result;
}

export function mutateAddPieceAlternative(
  piece: BudgetPiece,
  form: EntityFormState,
  materials: Material[],
  name: string,
): BudgetPiece {
  if (!piece.mainMaterial) {
    // Legacy path: no main material yet → treat the pick as the main.
    const list = addMaterialToList(
      { ...form, materials_data: [] },
      materials,
      name,
    );
    return list && list.length > 0
      ? { ...piece, mainMaterial: { ...list[0], ...pieceDims(piece), is_alternative: false } }
      : piece;
  }
  // Catalog lookup for the picked material — gives us the
  // identity (name, price, currency, color, category) that
  // the new alternative row needs.
  const catalogEntry = addMaterialToList(
    { ...form, materials_data: [] },
    materials,
    name,
  );
  if (!catalogEntry || catalogEntry.length === 0) return piece;
  const catalogRow = catalogEntry[0];
  // The "same mesada, different material" invariant: the
  // alternative carries the principal's PANES, not just one.
  // We materialise ONE alternative row per main row (anchor +
  // every `mainMaterialRows` tramo), each with the catalog
  // material's identity/prices but the principal row's dims.
  // Previously the helper returned a single row using only
  // `pieceDims(piece)` (the anchor), silently dropping every
  // additional pane — that was the bug.
  const mainRows = [
    piece.mainMaterial,
    ...(piece.mainMaterialRows || []),
  ].filter(Boolean) as MaterialInForm[];
  const existing = piece.alternativeMaterials || [];
  // A material already present as an alternative is a no-op: the
  // picker does NOT filter already-picked entries, and appending
  // it would create two cards with the same group key (duplicate
  // React keys + a duplicated material choice).
  const pickedKey = String(catalogRow.id ?? catalogRow.name);
  if (existing.some((a) => groupKeyOf(a) === pickedKey)) return piece;
  const next: MaterialInForm[] = mainRows.map((row) => ({
    ...catalogRow,
    length: Number(row.length) || 0,
    width: Number(row.width) || 0,
    quantity: Number(row.quantity) || 1,
    m2_used: 0,
    m2_budgeted: 0,
    is_alternative: true,
  }));
  // APPEND, never replace: each new pick adds a new alternative
  // slot, keeping every previously-picked alternative intact.
  return { ...piece, alternativeMaterials: [...existing, ...next] };
}

export function mutateAddPieceAlternativeRow(
  piece: BudgetPiece,
  groupKey: string,
  mat: MaterialInForm,
): BudgetPiece {
  // Strictly LOCAL: append the new pane to the alternative's
  // own rows. Do NOT touch the principal or other alternatives.
  const alts = piece.alternativeMaterials || [];
  const firstInGroup = alts.find((a) => groupKeyOf(a) === groupKey);
  // The new pane keeps the card's existing identity (price,
  // currency, color) — `mat` is the card's anchor row, so just
  // blank the dims and increment quantity is NOT needed (always
  // 1 by default). If `mat` lacks a name we fall back to the
  // first row of the group to keep the card coherent.
  const identity = mat && mat.name ? mat : (firstInGroup ?? mat);
  const newRow: MaterialInForm = {
    ...identity,
    quantity: 1,
    m2_used: 0,
    m2_budgeted: 0,
    length: 0,
    width: 0,
    is_alternative: true,
  };
  return {
    ...piece,
    alternativeMaterials: [...alts, newRow],
  };
}

export function mutateUpdatePieceAlternative(
  piece: BudgetPiece,
  groupKey: string,
  rowIdx: number,
  field: string,
  value: unknown,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  const alts = piece.alternativeMaterials || [];
  // Find the rowIdx-th row of the matching group and update only it.
  const newAlts: MaterialInForm[] = [];
  let seenInGroup = -1;
  let updated = false;
  for (const alt of alts) {
    if (groupKeyOf(alt) === groupKey) {
      seenInGroup++;
      if (seenInGroup === rowIdx && !updated) {
        newAlts.push({ ...alt, [field]: value } as MaterialInForm);
        updated = true;
        continue;
      }
    }
    newAlts.push(alt);
  }
  const base = { ...piece, alternativeMaterials: newAlts };
  return FRENTE_PRICE_FIELDS.has(field)
    ? refreshPieceFrentes(base, catalogueById)
    : base;
}

export function mutateUpdatePieceAlternativeGroup(
  piece: BudgetPiece,
  groupKey: string,
  field: string,
  value: unknown,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  // Apply to EVERY pane inside the same alternative card. The
  // card-level shared price input (in SingularMaterialCard's
  // `onUpdateGroup`) routes here so the operator only has to type
  // the price once per material.
  const newAlts = (piece.alternativeMaterials || []).map((a) =>
    groupKeyOf(a) === groupKey
      ? ({ ...a, [field]: value } as MaterialInForm)
      : a,
  );
  const base = { ...piece, alternativeMaterials: newAlts };
  // Same re-pricing discipline as `mutateUpdatePieceMainGroup`: a price
  // / currency edit on this alternative must also re-price the manual
  // fabrication rows assigned to it (otherwise its zócalos / manual
  // frentes stay frozen at the previous $/m²).
  const changedAlt = newAlts.find((a) => groupKeyOf(a) === groupKey);
  const nextFabrications =
    FRENTE_PRICE_FIELDS.has(field) && changedAlt
      ? refreshPieceFabricationDetails(piece.fabrication_details, changedAlt)
      : piece.fabrication_details;
  const pieceWithFab = { ...base, fabrication_details: nextFabrications };
  return FRENTE_PRICE_FIELDS.has(field)
    ? refreshPieceFrentes(pieceWithFab, catalogueById)
    : pieceWithFab;
}

export function mutateSwapPieceAlternative(
  piece: BudgetPiece,
  form: EntityFormState,
  groupKey: string,
  mat: Material,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  // Swap the material identity (name, price, color, currency)
  // for EVERY pane of the group. Pane dims survive.
  const alts = piece.alternativeMaterials || [];
  const swapped: MaterialInForm = {
    id: mat.id ?? null,
    name: mat.name,
    category: '',
    color: mat.color || '',
    price_m2: Number(mat.base_price) || 0,
    price_m2_usd: Number(mat.price_usd) || 0,
    currency: (mat.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD',
    quantity: 1,
    m2_used: 0,
    m2_budgeted: 0,
    length: 0,
    width: 0,
    is_alternative: true,
  };
  const newAlts = alts.map((a) =>
    groupKeyOf(a) === groupKey ? { ...a, ...swapped, length: a.length, width: a.width } : a,
  );
  // Re-point fabrication / additional-works references if the
  // name changed (mirrors `swapPieceMain`).
  const oldName = alts.find((a) => groupKeyOf(a) === groupKey)?.name;
  if (oldName && oldName !== mat.name) {
    const oldRows = alts.filter((a) => groupKeyOf(a) === groupKey);
    const synth: EntityFormState = {
      ...form,
      materials_data: oldRows,
      fabrication_details: piece.fabrication_details,
      additional_works_data: piece.additional_works_data,
      pools_data: [],
    };
    const refs = repointSwapReferences(
      synth,
      new Set([oldName].filter(Boolean) as string[]),
      mat.name,
      { mat, catalogueById },
    );
    const base: BudgetPiece = {
      ...piece,
      alternativeMaterials: newAlts,
      fabrication_details: refs.fabrication_details,
      additional_works_data: refs.additional_works_data ?? '[]',
    };
    return refreshPieceFrentes(base, catalogueById);
  }
  return refreshPieceFrentes({ ...piece, alternativeMaterials: newAlts }, catalogueById);
}

export function mutateRemovePieceAlternativeRow(
  piece: BudgetPiece,
  groupKey: string,
  rowIdx: number,
): BudgetPiece {
  const alts = piece.alternativeMaterials || [];
  // Drop the rowIdx-th row of the group; keep everything else.
  const newAlts: MaterialInForm[] = [];
  let seenInGroup = -1;
  for (const alt of alts) {
    if (groupKeyOf(alt) === groupKey) {
      seenInGroup++;
      if (seenInGroup === rowIdx) continue;
    }
    newAlts.push(alt);
  }
  return { ...piece, alternativeMaterials: newAlts };
}

export function mutateRemovePieceAlternative(
  piece: BudgetPiece,
  groupKey: string,
): BudgetPiece {
  // Drop EVERY pane of the group (whole card).
  const newAlts = (piece.alternativeMaterials || []).filter(
    (a) => groupKeyOf(a) !== groupKey,
  );
  return { ...piece, alternativeMaterials: newAlts };
}

export function mutateTogglePieceAlternative(
  piece: BudgetPiece,
  groupKey: string,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  const alts = piece.alternativeMaterials || [];
  const groupRows = alts.filter((a) => groupKeyOf(a) === groupKey);
  if (groupRows.length === 0) return piece;
  const remainingAlts = alts.filter((a) => groupKeyOf(a) !== groupKey);
  const previousMain = piece.mainMaterial;
  // Promote the FIRST pane of the group to the principal anchor;
  // the rest of the group's panes become `mainMaterialRows` so
  // the operator's measurements carry over without retyping.
  const newMain: MaterialInForm = { ...groupRows[0], is_alternative: false };
  const newMainRows: MaterialInForm[] = groupRows.slice(1).map((r) => ({
    ...r,
    is_alternative: false,
  }));
  // The previous main (if any) is demoted to an alternative with
  // its panes so the swap keeps every measurement the operator
  // had entered.
  const newAlts = previousMain
    ? [
        { ...previousMain, is_alternative: true },
        ...(piece.mainMaterialRows || []).map((r) => ({
          ...r,
          is_alternative: true,
        })),
        ...remainingAlts,
      ]
    : remainingAlts;
  return refreshPieceFrentes(
    {
      ...piece,
      mainMaterial: newMain,
      mainMaterialRows: newMainRows,
      alternativeMaterials: newAlts,
    },
    catalogueById,
  );
}

export function mutateAddPieceFabrication(piece: BudgetPiece): BudgetPiece {
  const singleMain = piece.mainMaterial;
  const base: FabricationDetail = {
    concept: 'BASEBOARD',
    detail: '',
    material: singleMain ? singleMain.name || '' : '',
    material_price_m2: singleMain
      ? singleMain.currency === 'USD'
        ? singleMain.price_m2_usd || 0
        : singleMain.price_m2 || 0
      : 0,
    length: null,
    width: null,
    m2: 0,
    labor: null,
    quantity: 1,
    currency: (singleMain?.currency as 'ARS' | 'USD') || 'ARS',
    price: 0,
  };
  return { ...piece, fabrication_details: [...piece.fabrication_details, base] };
}

export function mutateUpdatePieceFabrication(
  piece: BudgetPiece,
  idx: number,
  field: string,
  value: unknown,
  materials: Material[],
): BudgetPiece {
  const { ars, usd } = pieceMainPrices(piece);
  return {
    ...piece,
    fabrication_details: recomputeFabricationRow(
      piece.fabrication_details,
      idx,
      field,
      value,
      { materials, materialPriceArs: ars, materialUsd: usd, fallbackMaterialPriceM2: ars },
    ),
  };
}

export function mutateRemovePieceFabrication(
  piece: BudgetPiece,
  idx: number,
): BudgetPiece {
  return {
    ...piece,
    fabrication_details: piece.fabrication_details.filter((_, i) => i !== idx),
  };
}

export function mutateSetPieceAdditionalWorks(
  piece: BudgetPiece,
  json: string,
): BudgetPiece {
  return { ...piece, additional_works_data: json };
}

export function mutateUpdatePiecePool(
  piece: BudgetPiece,
  idx: number,
  field: string,
  value: unknown,
): BudgetPiece {
  const list = [...piece.pools];
  if (idx < 0 || idx >= list.length) return piece;
  list[idx] = { ...list[idx], [field]: value } as PoolInForm;
  return { ...piece, pools: list };
}

export function mutateRemovePiecePool(
  piece: BudgetPiece,
  idx: number,
): BudgetPiece {
  return {
    ...piece,
    pools: piece.pools.filter((_, i) => i !== idx),
  };
}

export function mutateSetPiecePoolFields(
  piece: BudgetPiece,
  idx: number,
  fields: Record<string, unknown>,
): BudgetPiece {
  const list = [...piece.pools];
  const next = { ...(list[idx] || {}), ...fields } as PoolInForm;
  if (idx >= list.length) list.push(next);
  else list[idx] = next;
  return { ...piece, pools: list };
}