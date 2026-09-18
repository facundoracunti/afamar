/**
 * Fase 3 — Descuento Comercial calculation helpers.
 *
 * The percentage runs against a base chosen by the operator:
 *  - 'total' → the whole document (subtotal + transport)
 *  - 'materials' → only the MAIN (non-alternative) materials
 *    (mármol/granito/cuarzo) — mano de obra, trasforos, piletas e
 *    ingletados a 45° are NOT discounted.
 *
 * `computeCommercialDiscount` mirrors the inline block in
 * `useBudgetCalculations.ts` (live form) and `buildPdfData.ts` (PDF
 * preview) — keep the three in sync. `computeMaterialsSubtotal` is the
 * single source of truth for the 'materials' base, matching the
 * `matArs` / `matUsd` totals of `useBudgetCalculations`.
 */

import type { MaterialInForm } from '@/types/budget';
import { round2 } from '@/utils/math';
import type { DiscountTarget } from '../types/discount';

export interface MaterialsSubtotal {
  /** ARS subtotal of the main (non-alternative) materials. */
  materialsSubtotalArs: number;
  /** USD subtotal of the main (non-alternative) materials. */
  materialsSubtotalUsd: number;
}

/** Subtotal of the main materials only (mármol/granito/cuarzo). */
export function computeMaterialsSubtotal(
  materialsData: MaterialInForm[],
  usdRate: number,
): MaterialsSubtotal {
  const main = (materialsData || []).filter((m) => !m.is_alternative);
  const ars = main
    .filter((m) => m.currency !== 'USD')
    .reduce(
      (sum, m) =>
        sum +
        (Number(m.length || 0) *
          Number(m.width || 0) *
          (m.quantity || 1) *
          (m.price_m2 || 0)),
      0,
    );
  const usd = main
    .filter((m) => m.currency === 'USD')
    .reduce(
      (sum, m) =>
        sum +
        (Number(m.length || 0) *
          Number(m.width || 0) *
          (m.quantity || 1) *
          (m.price_m2_usd || 0)),
      0,
    );
  const d = Number(usdRate) || 0;
  return {
    materialsSubtotalArs: ars + (d > 0 ? Math.round(usd * d * 100) / 100 : 0),
    materialsSubtotalUsd: usd + (d > 0 ? ars / d : 0),
  };
}

export interface CommercialDiscountInput {
  enabled: boolean;
  percentage: number;
  target: DiscountTarget;
  /** ARS total before the discount (subtotal + transport). */
  totalBaseArs: number;
  /** USD total before the discount (subtotal_usd + transport_usd). */
  totalBaseUsd: number;
  /** ARS main-materials subtotal (used only by target 'materials'). */
  materialsSubtotalArs: number;
  /** USD main-materials subtotal (used only by target 'materials'). */
  materialsSubtotalUsd: number;
}

export interface CommercialDiscountResult {
  /** True when the discount is enabled AND percentage > 0. */
  active: boolean;
  /** Base the percentage actually runs against (ARS). */
  baseArs: number;
  /** Base the percentage actually runs against (USD). */
  baseUsd: number;
  discountAmountArs: number;
  discountAmountUsd: number;
  /** ARS total after subtracting the discount. */
  totalAfterArs: number;
  /** USD total after subtracting the discount. */
  totalAfterUsd: number;
}

export function computeCommercialDiscount(
  input: CommercialDiscountInput,
): CommercialDiscountResult {
  const pct = Number(input.percentage) || 0;
  const active = input.enabled === true && pct > 0;
  if (!active) {
    return {
      active: false,
      baseArs: 0,
      baseUsd: 0,
      discountAmountArs: 0,
      discountAmountUsd: 0,
      totalAfterArs: Math.max(0, input.totalBaseArs),
      totalAfterUsd: Math.max(0, input.totalBaseUsd),
    };
  }

  const baseArs =
    input.target === 'materials' ? input.materialsSubtotalArs : input.totalBaseArs;
  const baseUsd =
    input.target === 'materials' ? input.materialsSubtotalUsd : input.totalBaseUsd;
  const discountAmountArs = Math.round(baseArs * pct) / 100;
  const discountAmountUsd = round2((baseUsd * pct) / 100);

  return {
    active: true,
    baseArs: Math.round(baseArs * 100) / 100,
    baseUsd: round2(baseUsd),
    discountAmountArs,
    discountAmountUsd,
    totalAfterArs: Math.max(
      0,
      Math.round((input.totalBaseArs - discountAmountArs) * 100) / 100,
    ),
    totalAfterUsd: round2(Math.max(0, input.totalBaseUsd - discountAmountUsd)),
  };
}