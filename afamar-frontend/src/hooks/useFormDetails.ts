import { useCallback, useRef } from 'react';
import type { Material } from '../types/material';
import type { EntityFormState, FabricationDetail, MaterialInForm, FormField } from '../types';
import { recomputeFabricationRow } from '@features/budgets/utils/fabricationDetails';

interface UseFormDetailsParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  materials: Material[];
}

interface UseFormDetailsReturn {
  handleDetailChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
  materialPrecioRef: React.MutableRefObject<number>;
  materialUsdRef: React.MutableRefObject<number>;
}

/**
 * Composable: CRUD for `fabrication_details` rows (each row is a fabrication
 * concept: ZÓCALO, FRENTE, TRAFORO DE PILETA, OTRA, ...).
 *
 * Also exposes the material-price refs that the per-row material change
 * handler needs (shared with `useFormMaterials.handleMaterialChange`).
 */
export function useFormDetails({
  form,
  setForm,
  update,
  materials,
}: UseFormDetailsParams): UseFormDetailsReturn {
  const materialPrecioRef = useRef<number>(0);
  const materialUsdRef = useRef<number>(0);

  const handleDetailChange = useCallback(
    (idx: number, field: string, value: unknown) => {
      setForm((prev) => ({
        ...prev,
        fabrication_details: recomputeFabricationRow(prev.fabrication_details, idx, field, value, {
          materials,
          materialPriceArs: materialPrecioRef.current || 0,
          materialUsd: materialUsdRef.current || 0,
          fallbackMaterialPriceM2: Number(prev.material_price_m2) || 0,
        }),
      }));
    },
    [materials]
  );

  const addDetalle = useCallback(() => {
    // eslint-disable-next-line no-console
    console.count('[addDetalle]');
    // Auto-consume the loaded material when there is exactly one material in
    // the form (normal budget with a single option). When alternatives exist
    // (multiple `materials_data` rows / `is_alternative`), the "Asignar a
    // opción" select must default to GLOBAL (`material: ''`) — the additional
    // concept then sums into the total without being pinned to any option.
    const formMaterials = form.materials_data || [];
    const singleMain =
      formMaterials.length === 1 && !formMaterials[0].is_alternative
        ? formMaterials[0]
        : null;

    const base: FabricationDetail = {
      concept: 'BASEBOARD',
      detail: '',
      material: singleMain ? (singleMain.name || '') : '',
      material_price_m2: singleMain
        ? (singleMain.currency === 'USD'
            ? (singleMain.price_m2_usd || 0)
            : (singleMain.price_m2 || 0))
        : 0,
      length: null,
      width: null,
      m2: 0,
      labor: null,
      quantity: 1,
      currency: (singleMain?.currency as 'ARS' | 'USD') || 'ARS',
      price: 0,
    };
    update('fabrication_details', [
      ...(form.fabrication_details || []),
      base,
    ]);
  }, [form.fabrication_details, form.materials_data, update]);

  const removeDetalle = useCallback(
    (idx: number) => {
      // Allow removing the last fabrication row — `fabrication_details` is a
      // normal list, and the UI's "Sin materiales adicionales" empty state
      // takes over when length drops to zero. The previous guard
      // (`if (length <= 1) return;`) blocked the operator from deleting
      // the only row they had just added, which broke the Materiales
      // Adicionales removal flow.
      update('fabrication_details', form.fabrication_details.filter((_, i) => i !== idx));
    },
    [form.fabrication_details, update]
  );

  return { handleDetailChange, addDetalle, removeDetalle, materialPrecioRef, materialUsdRef };
}

// Re-export so `useFormMaterials` can detect alternatives without depending on the
// form state directly. Consumers keep importing the type from `types/`.
export type { MaterialInForm };