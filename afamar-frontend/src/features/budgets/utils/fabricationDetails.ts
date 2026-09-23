/**
 * Fabrication row helpers.
 *
 * A fabrication row (`BASEBOARD`, `FRONT`, `CUTOUT_SINK`, etc.) tracks
 * `length` × `width` × `quantity` × `price` plus an optional `material`
 * reference that ties the row to a specific mesada material so the PDF
 * can re-price it when an alternative swaps the material.
 *
 * M²-based rows (BASEBOARD, FRONT — see `M2_CONCEPTS`) are priced from
 * their area: `price = length × width × $/m²` of the assigned material.
 * The price is recomputed the moment the concept is switched to an m²
 * row, the operator edits `length`/`width`, or the assigned material
 * changes — a `FRENTE` row is never left frozen at $0 once its dims are
 * filled.
 */

import type { FabricationDetail, Material } from '@/types';
import { M2_CONCEPTS } from '@/hooks/entityFormConstants';

/** Raw m² area (length × width, no rounding). */
function detailM2(d: FabricationDetail): number {
  return Number(d.length || 0) * Number(d.width || 0);
}

/** Compute the m² label shown in fabrication tables. */
function detailM2Label(d: FabricationDetail): string {
  return detailM2(d).toFixed(2);
}

/** Compute the raw row subtotal in ARS (price × qty × currency conversion). */
function detailSubtotalArs(d: FabricationDetail): number {
  const price = Number(d.price || 0);
  const qty = Number(d.quantity || 1);
  return price * qty;
}

interface RecomputeCtx {
  materials: Material[];
  /** Per-m² price of the principal material of THIS piece (ARS). */
  materialPriceArs: number;
  /** Per-m² price of the principal material of THIS piece (USD). */
  materialUsd: number;
  /** Fallback when no material link is found. */
  fallbackMaterialPriceM2: number;
}

/** Per-m² price this row should be priced at: the linked catalogue
 *  material's $/m² (in its own currency), else the row's
 *  `material_price_m2` snapshot, else the piece principal's price (in the
 *  row's currency). */
function resolveRowPerM2(row: FabricationDetail, ctx: RecomputeCtx): number {
  if (row.material) {
    const linked = ctx.materials.find(
      (m) => m.name === String(row.material) || String(m.id) === String(row.material),
    );
    if (linked) {
      return linked.currency === 'USD'
        ? Number(linked.price_usd || 0)
        : Number(linked.base_price || 0);
    }
  }
  if (Number(row.material_price_m2 || 0) > 0) return Number(row.material_price_m2);
  const perM2 = row.currency === 'USD' ? ctx.materialUsd : ctx.materialPriceArs;
  return perM2 || ctx.fallbackMaterialPriceM2;
}

/** Recompute the stored `m2` label and, for m² rows, `price = m² × $/m²`
 *  of the assigned material (mirrors the legacy
 *  `useFormMaterials.handleMaterialChange`). Non-m² rows only refresh
 *  their `m2` label — their price stays operator-entered. */
function refreshRow(current: FabricationDetail, ctx: RecomputeCtx): FabricationDetail {
  const withM2 = { ...current, m2: Number(detailM2Label(current)) };
  if (!M2_CONCEPTS.includes(String(current.concept || ''))) return withM2;
  const price = Math.round(detailM2(current) * resolveRowPerM2(withM2, ctx) * 100) / 100;
  return { ...withM2, price };
}

/**
 * Recompute a single fabrication row after the operator edits a field
 * (`length`, `width`, `quantity`, `price`, `material`, `labor`, `concept`,
 * `currency`, etc.) and return a NEW array with the updated row in place.
 *
 * M²-based rows (BASEBOARD, FRONT — see `M2_CONCEPTS`) recompute `m2`
 * from length × width and, on ANY relevant edit (concept switch, dims,
 * assigned material), re-price as `m² × $/m²` of the linked material —
 * so a FRENTE entered with measurements is never left at $0. Rows that
 * reference a `material` get their `price` auto-filled from the linked
 * material's `price_m2` when the operator changes `material` (or blanks
 * `price`), and their currency follows the linked material's currency.
 */
export function recomputeFabricationRow(
  details: FabricationDetail[],
  idx: number,
  field: string,
  value: unknown,
  ctx: RecomputeCtx,
): FabricationDetail[] {
  const list = [...details];
  if (idx < 0 || idx >= list.length) return list;
  const current = { ...list[idx], [field]: value } as FabricationDetail;
  list[idx] = current;

  // When the operator picks a material from the dropdown, auto-fill
  // price/currency from the catalogue so the row stays in sync with the
  // mesada's principal. M² rows re-price at `m² × $/m²` right away.
  if (field === 'material') {
    const linked = ctx.materials.find(
      (m) => m.name === String(value) || String(m.id) === String(value),
    );
    if (linked) {
      const isUsd = linked.currency === 'USD';
      const perM2 = isUsd ? Number(linked.price_usd || 0) : Number(linked.base_price || 0);
      const linkedRow = {
        ...current,
        material: linked.name,
        material_price_m2: perM2,
        currency: isUsd ? 'USD' : ('ARS' as const),
      } as FabricationDetail;
      if (M2_CONCEPTS.includes(String(current.concept || ''))) {
        list[idx] = refreshRow(linkedRow, ctx);
      } else {
        list[idx] = { ...linkedRow, price: current.price || perM2 };
      }
    } else {
      list[idx] = refreshRow(current, ctx);
    }
    return list;
  }

  // For length / width / quantity, keep `m2` in sync and re-price m² rows
  // from the area so the price follows the measurements.
  if (field === 'length' || field === 'width' || field === 'quantity') {
    list[idx] = refreshRow(current, ctx);
    return list;
  }

  // Switching the row type (e.g. BASEBOARD → FRENTE) re-prices m² rows so
  // the FRENTE never stays frozen at $0 once dims are filled.
  if (field === 'concept') {
    list[idx] = refreshRow(current, ctx);
    return list;
  }

  // Price re-pricing: if the operator blanks the price, fall back to the
  // linked material's per-m² (or the fallback) so the row doesn't drop
  // to zero.
  if (field === 'price' && (!current.price || current.price === 0)) {
    const fallback = current.material_price_m2 || ctx.fallbackMaterialPriceM2;
    list[idx] = { ...current, price: fallback };
  }

  return list;
}

export { detailM2Label, detailSubtotalArs };