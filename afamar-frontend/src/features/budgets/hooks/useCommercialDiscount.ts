/**
 * Fase 3 — Commercial discount hook for budgets.
 *
 * Bridges `EntityFormState` with the `DiscountSelector` component and
 * exposes the live discount computation so the UI never shows stale
 * values. The percentage reuses the pre-existing `discount_percentage`
 * field (persisted via the API); the remaining fields are form-local
 * and ignored by the backend until a future phase.
 */

import type { EntityFormState, FormField } from '@/types/form';
import type { DiscountTarget } from '../types/discount';
import {
  computeCommercialDiscount,
  computeMaterialsSubtotal,
} from '../utils/commercialDiscount';

export interface UseCommercialDiscountReturn {
  enabled: boolean;
  percentage: number;
  target: DiscountTarget;
  isActive: boolean;
  materialsSubtotalArs: number;
  materialsSubtotalUsd: number;
  baseArs: number;
  baseUsd: number;
  discountAmountArs: number;
  discountAmountUsd: number;
  totalAfterArs: number;
  totalAfterUsd: number;
  setEnabled: (value: boolean) => void;
  setPercentage: (value: number | string) => void;
  setTarget: (target: DiscountTarget) => void;
}

export function useCommercialDiscount(
  form: EntityFormState,
  update: (field: FormField, value: unknown) => void,
): UseCommercialDiscountReturn {
  const enabled = form.discount_enabled === true;
  const percentage = Number(form.discount_percentage) || 0;
  const target: DiscountTarget =
    form.discount_target === 'materials' ? 'materials' : 'total';

  const materials = computeMaterialsSubtotal(
    form.materials_data || [],
    Number(form.usd_rate) || 0,
  );

  const totalBaseArs = Math.max(
    0,
    (Number(form.subtotal) || 0) + (Number(form.transport) || 0),
  );
  const totalBaseUsd = Math.max(
    0,
    (Number(form.subtotal_usd) || 0) + (Number(form.transport_usd) || 0),
  );

  const calc = computeCommercialDiscount({
    enabled,
    percentage,
    target,
    totalBaseArs,
    totalBaseUsd,
    materialsSubtotalArs: materials.materialsSubtotalArs,
    materialsSubtotalUsd: materials.materialsSubtotalUsd,
  });

  const setEnabled = (value: boolean) => update('discount_enabled', value);
  const setPercentage = (value: number | string) =>
    update('discount_percentage', Number(value) || 0);
  const setTarget = (t: DiscountTarget) => update('discount_target', t);

  return {
    enabled,
    percentage,
    target,
    isActive: calc.active,
    materialsSubtotalArs: materials.materialsSubtotalArs,
    materialsSubtotalUsd: materials.materialsSubtotalUsd,
    baseArs: calc.baseArs,
    baseUsd: calc.baseUsd,
    discountAmountArs: calc.discountAmountArs,
    discountAmountUsd: calc.discountAmountUsd,
    totalAfterArs: calc.totalAfterArs,
    totalAfterUsd: calc.totalAfterUsd,
    setEnabled,
    setPercentage,
    setTarget,
  };
}