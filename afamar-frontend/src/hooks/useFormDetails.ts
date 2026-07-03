import { useCallback, useRef } from 'react';
import type { Material } from '../types/material';
import type { EntityFormState, FabricationDetail, MaterialInForm, FormField } from '../types';
import { M2_CONCEPTS, CUTOUT_DETAILS } from './entityFormHelpers';

interface UseFormDetailsParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  materiales: Material[];
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
  materiales,
}: UseFormDetailsParams): UseFormDetailsReturn {
  const materialPrecioRef = useRef<number>(0);
  const materialUsdRef = useRef<number>(0);

  const handleDetailChange = useCallback(
    (idx: number, field: string, value: unknown) => {
      setForm((prev) => {
        const list = [...(prev.fabrication_details || [])];
        list[idx] = { ...list[idx], [field]: value } as FabricationDetail;
        if (field === 'concepto' && value !== 'OTRA') {
          list[idx].concepto_personalizado = '';
        }
        if (field === 'concepto' && CUTOUT_DETAILS[value as string]) {
          list[idx].detalle = CUTOUT_DETAILS[value as string];
        }
        const d = list[idx];

        if (field === 'material') {
          const mat = materiales.find((m) => m.name === value);
          if (mat) {
            list[idx].material = value as string;
            list[idx].moneda = mat.currency || 'ARS';
            list[idx].material_precio_m2 = mat.currency === 'USD' ? (mat.priceUsd || 0) : (mat.basePrice || 0);
            if (M2_CONCEPTS.includes(d.concepto) && d.m2 > 0) {
              list[idx].precio = Math.round(d.m2 * (list[idx].material_precio_m2 || 0) * 100) / 100;
            }
          } else {
            list[idx].material = '';
            list[idx].material_precio_m2 = 0;
          }
        }

        if (d.concepto === 'OTRA' && (field === 'largo' || field === 'mano_de_obra')) {
          const largo = Number(d.largo) || 0;
          const mo = Number(d.mano_de_obra) || 0;
          list[idx].precio = Math.round(largo * mo * 100) / 100;
        } else if (
          M2_CONCEPTS.includes(d.concepto) &&
          (field === 'concepto' || field === 'largo' || field === 'ancho' || field === 'moneda' || field === 'material')
        ) {
          const largo = Number(d.largo) || 0;
          const ancho = Number(d.ancho) || 0;
          const m2 = Math.round(largo * ancho * 100000) / 100000;
          list[idx].m2 = m2;
          const moneda = d.moneda || 'ARS';
          let pm2 = 0;
          if (d.material) {
            const mat = materiales.find((m) => m.name === d.material);
            if (mat) {
              pm2 = moneda === 'USD' ? (mat.priceUsd || 0) : (mat.basePrice || 0);
            }
          } else {
            pm2 =
              moneda === 'USD'
                ? (materialUsdRef.current || 0)
                : (Number(materialPrecioRef.current) || Number(prev.material_price_m2) || 0);
          }
          list[idx].precio = Math.round(m2 * pm2 * 100) / 100;
        }
        return { ...prev, fabrication_details: list };
      });
    },
    [materiales]
  );

  const addDetalle = useCallback(() => {
    update('fabrication_details', [
      ...(form.fabrication_details || []),
      {
        concepto: 'ZÓCALO',
        detalle: '',
        material: '',
        material_precio_m2: 0,
        largo: null,
        ancho: null,
        m2: 0,
        mano_de_obra: null,
        cantidad: 1,
        moneda: 'ARS' as const,
        precio: 0,
      },
    ]);
  }, [form.fabrication_details, update]);

  const removeDetalle = useCallback(
    (idx: number) => {
      if (form.fabrication_details.length <= 1) return;
      update('fabrication_details', form.fabrication_details.filter((_, i) => i !== idx));
    },
    [form.fabrication_details, update]
  );

  return { handleDetailChange, addDetalle, removeDetalle, materialPrecioRef, materialUsdRef };
}

// Re-export so `useFormMaterials` can detect alternatives without depending on the
// form state directly. Consumers keep importing the type from `types/`.
export type { MaterialInForm };