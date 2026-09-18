/**
 * Fabrication row helpers.
 *
 * A fabrication row (`BASEBOARD`, `FRONT`, `CUTOUT_SINK`, etc.) tracks
 * `length` × `width` × `quantity` × `price` plus an optional `material`
 * reference that ties the row to a specific mesada material so the PDF
 * can re-price it when an alternative swaps the material.
 */

import type { FabricationDetail, Material } from '@/types';

/** Compute the m² label shown in fabrication tables. */
function detailM2Label(d: FabricationDetail): string {
  return (Number(d.length || 0) * Number(d.width || 0)).toFixed(2);
}

/** Compute the raw row subtotal in ARS (price × qty × currency conversion). */
function detailSubtotalArs(d: FabricationDetail): number {
  const price = Number(d.price || 0);
  const qty = Number(d.quantity || 1);
  return price * qty;
}

/**
 * Recompute a single fabrication row after the operator edits a field
 * (`length`, `width`, `quantity`, `price`, `material`, `labor`, `concept`,
 * `currency`, etc.) and return a NEW array with the updated row in place.
 *
 * M²-based rows (BASEBOARD, FRONT — see `M2_CONCEPTS`) recompute `m2`
 * from length × width. Rows that reference a `material` get their `price`
 * auto-filled from the linked material's `price_m2` when the operator
 * changes `material` (or blanks `price`), and their currency follows the
 * linked material's currency.
 */
export function recomputeFabricationRow(
  details: FabricationDetail[],
  idx: number,
  field: string,
  value: unknown,
  ctx: {
    materials: Material[];
    /** Per-m² price of the principal material of THIS piece (ARS). */
    materialPriceArs: number;
    /** Per-m² price of the principal material of THIS piece (USD). */
    materialUsd: number;
    /** Fallback when no material link is found. */
    fallbackMaterialPriceM2: number;
  },
): FabricationDetail[] {
  const list = [...details];
  if (idx < 0 || idx >= list.length) return list;
  const current = { ...list[idx], [field]: value } as FabricationDetail;
  list[idx] = current;

  // When the operator picks a material from the dropdown, auto-fill
  // price/currency from the catalogue so the row stays in sync with the
  // mesada's principal.
  if (field === 'material') {
    const linked = ctx.materials.find(
      (m) => m.name === String(value) || String(m.id) === String(value),
    );
    if (linked) {
      const isUsd = linked.currency === 'USD';
      const perM2 = isUsd ? Number(linked.price_usd || 0) : Number(linked.base_price || 0);
      list[idx] = {
        ...current,
        material: linked.name,
        material_price_m2: perM2,
        currency: isUsd ? 'USD' : 'ARS',
        price: current.price || perM2,
      };
    }
    return list;
  }

  // For length / width / quantity on an m²-based concept, keep `m2` in sync.
  if (field === 'length' || field === 'width' || field === 'quantity') {
    list[idx] = { ...current, m2: detailM2Label(current) as unknown as number };
    // `m2` in `FabricationDetail` is typed as number — cast the formatted
    // string back to number to keep the rest of the system stable.
    list[idx].m2 = Number(detailM2Label(current));
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
