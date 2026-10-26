/**
 * RE-PRICING of the rows that depend on a material's price.
 *
 * Two independent chains react to a $/m² (or currency) edit of a
 * material:
 *
 *  - `refreshPieceFrentes` → the piece's `frente` rows of
 *    `additional_works_data` (the catalogue-driven frente).
 *  - `refreshPieceFabricationDetails` → the piece's manual zócalo /
 *    frente rows of `fabrication_details`.
 *
 * Both live here so the material mutator modules share ONE pricing
 * discipline and can never drift apart.
 */
import type {
  BudgetPiece,
  FabricationDetail,
  MaterialInForm,
  PriceSource,
} from '@/types/budget';
import { POOL_MATERIAL_GLOBAL } from '@/types/budget';
import type { AdditionalWork } from '@/types/additionalWork';
import { M2_CONCEPTS } from '@/hooks/entityFormConstants';
import type { AdditionalWorkSelection } from '@/utils/additionalWorkParse';
import { parseAdditionalWorksData, serializeAdditionalWorksData } from '@/utils/additionalWorkParse';
import {
  buildFrenteMaterialOptions,
  computeFrenteTotal,
  resolveFrenteMultiplier,
} from '@/utils/frentePricing';

function isManualPriceSource(source: PriceSource | undefined): boolean {
  return source === 'manual';
}

/**
 * Legacy rows have no provenance marker. Only infer catalogue origin when a
 * dimensional row exactly matches its stored material-price snapshot; an
 * ambiguous row is preserved rather than overwritten.
 */
function isLegacyAutomaticFabricationPrice(row: FabricationDetail): boolean {
  if (row.price_source === 'catalog') return true;
  if (row.price_source === 'manual') return false;
  const m2 = Number(row.length || 0) * Number(row.width || 0) * Number(row.quantity || 1);
  const snapshot = Number(row.material_price_m2 || 0);
  if (m2 <= 0) return Number(row.price || 0) === 0;
  if (snapshot <= 0) return false;
  const expected = Math.round(m2 * snapshot * 100) / 100;
  return Math.abs(Number(row.price || 0) - expected) < 0.01;
}

function isLegacyAutomaticFrentePrice(row: AdditionalWorkSelection): boolean {
  if (row.price_source === 'catalog') return true;
  if (row.price_source === 'manual') return false;
  return row.formula_values != null;
}

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
    if (!isLegacyAutomaticFabricationPrice(d) || isManualPriceSource(d.price_source)) return d;

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
      price_source: 'catalog',
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
export function refreshPieceFrentes(
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
    if (!isLegacyAutomaticFrentePrice(row)) return row;
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
      price_source: 'catalog',
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
