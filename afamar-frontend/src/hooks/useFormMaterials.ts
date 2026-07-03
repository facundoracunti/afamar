import { useCallback } from 'react';
import type { Material } from '../types/material';
import type { EntityFormState, FormField, MaterialInForm } from '../types';
import { M2_CONCEPTS, addMaterialToList } from './entityFormHelpers';
import type { MutableRefObject } from 'react';

interface UseFormMaterialsParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  materiales: Material[];
  materialPrecioRef: MutableRefObject<number>;
  materialUsdRef: MutableRefObject<number>;
}

interface UseFormMaterialsReturn {
  handleMaterialChange: (name: string) => void;
  addMaterial: (name: string) => void;
  removeMaterial: (idx: number) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
}

/**
 * Composable: handles the "material principal" picker plus the
 * `materials_data` CRUD (the selected/alternative material stack).
 *
 * Encapsulates:
 *  - handleMaterialChange: when the user picks a material, propagate
 *    color/thickness/price into the form, and refresh fabrication rows
 *    whose `concepto` is a per-m2 concept.
 *  - add/remove/update materials_data.
 *  - hayUSD / hayAlternativas derived flags.
 */
export function useFormMaterials({
  form,
  setForm,
  update,
  materiales,
  materialPrecioRef,
  materialUsdRef,
}: UseFormMaterialsParams): UseFormMaterialsReturn {
  const handleMaterialChange = useCallback(
    (name: string) => {
      const m = materiales.find((mat) => mat.name === name);
      if (m) {
        const currency = m.currency || 'ARS';
        const usdPrice = m.price_usd || 0;
        const arsPrice = m.base_price || 0;
        materialUsdRef.current = usdPrice;
        setForm((prev) => {
          const tc = prev.usd_rate ?? 1000;
          const pm2 = currency === 'USD' ? Math.round(usdPrice * tc * 100) / 100 : arsPrice;
          materialPrecioRef.current = pm2;
          return {
            ...prev,
            material: name,
            color: m.color || '',
            thickness: m.available_thickness || '',
            material_price_m2: pm2,
            fabrication_details: (prev.fabrication_details || []).map((d) => {
              if (M2_CONCEPTS.includes(d.concepto) && d.m2 > 0) {
                return { ...d, moneda: currency as 'ARS' | 'USD', precio: Math.round(d.m2 * pm2 * 100) / 100 };
              }
              return d;
            }),
          };
        });
      } else {
        materialUsdRef.current = 0;
        setForm((prev) => ({ ...prev, material: name, material_price_m2: 0 }));
      }
    },
    [materiales, materialPrecioRef, materialUsdRef]
  );

  const addMaterial = useCallback(
    (name: string) => {
      const list = addMaterialToList(form, materiales, name);
      if (list) update('materials_data', list);
    },
    [form, materiales, update]
  );

  const removeMaterial = useCallback(
    (idx: number) => {
      const list = (form.materials_data as MaterialInForm[]) || [];
      update('materials_data', list.filter((_, i) => i !== idx));
    },
    [form.materials_data, update]
  );

  const updateMaterial = useCallback(
    (idx: number, field: string, value: unknown) => {
      const list = [...(form.materials_data as MaterialInForm[])];
      (list[idx] as unknown as Record<string, unknown>)[field] = value;
      update('materials_data', list);
    },
    [form.materials_data, update]
  );

  const materialsList = (form.materials_data as MaterialInForm[]) || [];
  const hayUSD = materialsList.some((m) => m.currency === 'USD');
  const hayAlternativas = materialsList.some((m) => m.is_alternative);

  return { handleMaterialChange, addMaterial, removeMaterial, updateMaterial, hayUSD, hayAlternativas };
}