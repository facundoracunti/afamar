import { useCallback, useRef } from 'react';
import type { Material } from '../types/material';
import type { EntityFormState, FabricationDetail, MaterialInForm, FormField } from '../types';
import { M2_CONCEPTS, CUTOUT_DETAILS } from './entityFormHelpers';

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
      setForm((prev) => {
        const list = [...(prev.fabrication_details || [])];
        list[idx] = { ...list[idx], [field]: value } as FabricationDetail;
        if (field === 'concept' && value !== 'OTHER') {
          list[idx].custom_concept = '';
        }
        if (field === 'concept' && CUTOUT_DETAILS[value as string]) {
          list[idx].detail = CUTOUT_DETAILS[value as string];
        }
        const d = list[idx];

        if (field === 'material') {
          const mat = materials.find((m) => m.name === value);
          if (mat) {
            list[idx].material = value as string;
            list[idx].currency = mat.currency || 'ARS';
            list[idx].material_price_m2 = mat.currency === 'USD' ? (mat.price_usd || 0) : (mat.base_price || 0);
            if (M2_CONCEPTS.includes(d.concept) && d.m2 > 0) {
              list[idx].price = Math.round(d.m2 * (list[idx].material_price_m2 || 0) * 100) / 100;
            }
          } else {
            list[idx].material = '';
            list[idx].material_price_m2 = 0;
          }
        }

        if (d.concept === 'OTHER' && (field === 'length' || field === 'labor')) {
          const length = Number(d.length) || 0;
          const mo = Number(d.labor) || 0;
          list[idx].price = Math.round(length * mo * 100) / 100;
        } else if (
          M2_CONCEPTS.includes(d.concept) &&
          (field === 'concept' || field === 'length' || field === 'width' || field === 'currency' || field === 'material')
        ) {
          const length = Number(d.length) || 0;
          const width = Number(d.width) || 0;
          const m2 = Math.round(length * width * 100000) / 100000;
          list[idx].m2 = m2;
          const currency = d.currency || 'ARS';
          let pm2 = 0;
          if (d.material) {
            const mat = materials.find((m) => m.name === d.material);
            if (mat) {
              pm2 = currency === 'USD' ? (mat.price_usd || 0) : (mat.base_price || 0);
            }
          } else {
            pm2 =
              currency === 'USD'
                ? (materialUsdRef.current || 0)
                : (Number(materialPrecioRef.current) || Number(prev.material_price_m2) || 0);
          }
          list[idx].price = Math.round(m2 * pm2 * 100) / 100;
        }
        return { ...prev, fabrication_details: list };
      });
    },
    [materials]
  );

  const addDetalle = useCallback(() => {
    // eslint-disable-next-line no-console
    console.count('[addDetalle]');
    update('fabrication_details', [
      ...(form.fabrication_details || []),
      {
        concept: 'BASEBOARD',
        detail: '',
        material: '',
        material_price_m2: 0,
        length: null,
        width: null,
        m2: 0,
        labor: null,
        quantity: 1,
        currency: 'ARS' as const,
        price: 0,
      },
    ]);
  }, [form.fabrication_details, update]);

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