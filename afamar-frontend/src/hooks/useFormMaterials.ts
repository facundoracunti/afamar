import { useCallback } from 'react';
import type { Material } from '../types/material';
import type { EntityFormState, FormField, MaterialInForm } from '../types';
import { M2_CONCEPTS, addMaterialToList, addMaterialRowToList, repointSwapReferences, swapMaterialGroupToList } from './entityFormHelpers';
import type { MutableRefObject } from 'react';

interface UseFormMaterialsParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  materials: Material[];
  materialPrecioRef: MutableRefObject<number>;
  materialUsdRef: MutableRefObject<number>;
}

interface UseFormMaterialsReturn {
  handleMaterialChange: (name: string) => void;
  addMaterial: (name: string) => void;
  removeMaterial: (idx: number) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  /** Add another measurement row of an already-selected material (keeps
   *  `materials_data` flat — the MaterialCard renders one card per
   *  material with N rows grouped in the UI layer). */
  addMaterialRow: (mat: MaterialInForm) => void;
  /** Remove every row whose global index is in `idxs` (a whole card). */
  removeMaterialGroup: (idxs: number[]) => void;
  /** Set `field` on every row whose global index is in `idxs` in a single
   *  state update (e.g. toggling the "Alternativa" checkbox on a card). */
  updateMaterialGroup: (idxs: number[], field: string, value: unknown) => void;
  /** Replace the catalogue identity (name/color/prices/currency) of every
   *  row whose global index is in `idxs` (a whole card), keeping each
   *  row's measurements and alternative flag. */
  swapMaterialGroup: (idxs: number[], mat: Material) => void;
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
  materials,
  materialPrecioRef,
  materialUsdRef,
}: UseFormMaterialsParams): UseFormMaterialsReturn {
  const handleMaterialChange = useCallback(
    (name: string) => {
      const m = materials.find((mat) => mat.name === name);
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
              if (M2_CONCEPTS.includes(d.concept) && d.m2 > 0) {
                return { ...d, currency: currency as 'ARS' | 'USD', price: Math.round(d.m2 * pm2 * 100) / 100 };
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
    [materials, materialPrecioRef, materialUsdRef]
  );

  const addMaterial = useCallback(
    (name: string) => {
      const list = addMaterialToList(form, materials, name);
      if (list) update('materials_data', list);
    },
    [form, materials, update]
  );

  const removeMaterial = useCallback(
    (idx: number) => {
      const list = form.materials_data || [];
      update('materials_data', list.filter((_, i) => i !== idx));
    },
    [form.materials_data, update]
  );

  const updateMaterial = useCallback(
    (idx: number, field: string, value: unknown) => {
      const list = [...(form.materials_data || [])];
      // Dynamic-key setter: `MaterialInForm` has known keys, but the
      // form's edit handlers pass arbitrary field names. The cast
      // preserves the surrounding object type.
      (list[idx] as unknown as Record<string, unknown>)[field] = value;
      update('materials_data', list);
    },
    [form.materials_data, update]
  );

  const addMaterialRow = useCallback(
    (mat: MaterialInForm) => {
      const list = addMaterialRowToList(form, mat);
      if (list) update('materials_data', list);
    },
    [form, update]
  );

  const removeMaterialGroup = useCallback(
    (idxs: number[]) => {
      const set = new Set(idxs);
      const list = (form.materials_data || []).filter((_, i) => !set.has(i));
      update('materials_data', list);
    },
    [form.materials_data, update]
  );

  const updateMaterialGroup = useCallback(
    (idxs: number[], field: string, value: unknown) => {
      const list = [...(form.materials_data || [])];
      const indexSet = new Set(idxs);
      for (let i = 0; i < list.length; i += 1) {
        if (indexSet.has(i)) {
          (list[i] as unknown as Record<string, unknown>)[field] = value;
        }
      }
      update('materials_data', list);
    },
    [form.materials_data, update]
  );

  const swapMaterialGroup = useCallback(
    (idxs: number[], mat: Material) => {
      const list = swapMaterialGroupToList(form, idxs, mat);
      if (!list) return;
      const oldNames = new Set(
        idxs
          .map((i) => form.materials_data?.[i]?.name)
          .filter((name): name is string => !!name),
      );
      const refs = repointSwapReferences(form, oldNames, mat.name);
      setForm((prev) => ({
        ...prev,
        materials_data: list,
        pools_data: refs.pools_data,
        fabrication_details: refs.fabrication_details,
        additional_works_data: refs.additional_works_data,
      }));
    },
    [form, setForm]
  );

  const materialsList = form.materials_data || [];
  const hayUSD = materialsList.some((m) => m.currency === 'USD');
  const hayAlternativas = materialsList.some((m) => m.is_alternative);

  return {
    handleMaterialChange,
    addMaterial,
    removeMaterial,
    updateMaterial,
    addMaterialRow,
    removeMaterialGroup,
    updateMaterialGroup,
    swapMaterialGroup,
    hayUSD,
    hayAlternativas,
  };
}