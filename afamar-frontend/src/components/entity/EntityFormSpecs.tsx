import React, { useMemo } from 'react';
import MaterialCard from '../../components/materials/MaterialCard/MaterialCard';
import MaterialPickerControls from '../../components/materials/MaterialPickerControls/MaterialPickerControls';
import { useList } from '../../api/hooks';
import { getMaterialCategories, type MaterialCategory } from '../../api/resources/materials';
import type { EntityFormState, MaterialInForm } from '../../types';
import type { Material } from '../../types/material';
import { materialGroupKey } from '../../utils/materialGroups';
import styles from './EntityFormSpecs.module.css';

const s = styles as unknown as Record<string, string>;

interface EntityFormSpecsProps {
  form: EntityFormState;
  readOnly: boolean;
  materials: Material[];
  addMaterial: (name: string) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  removeMaterial: (idx: number) => void;
  addMaterialRow: (mat: MaterialInForm) => void;
  removeMaterialGroup: (idxs: number[]) => void;
  updateMaterialGroup: (idxs: number[], field: string, value: unknown) => void;
  swapMaterialGroup: (idxs: number[], mat: Material) => void;
  update: (field: string, value: unknown) => void;
  num: (v: string) => number | null;
  cardClassName?: string;
}

interface MaterialRowGroup {
  rows: Array<{ mat: MaterialInForm; idx: number }>;
  groupKey: string;
}

export default function EntityFormSpecs({
  form,
  readOnly,
  materials,
  addMaterial,
  updateMaterial,
  removeMaterial,
  addMaterialRow,
  removeMaterialGroup,
  updateMaterialGroup,
  swapMaterialGroup,
  update,
  num,
  cardClassName,
}: EntityFormSpecsProps) {
  const { items: categorias } = useList<MaterialCategory>(
    ['material-categories', 'all'],
    async () => {
      const res = await getMaterialCategories();
      return (res.data as MaterialCategory[]) || [];
    }
  );

  // Group `materials_data` (flat) into one card per physical material —
  // the MaterialCard renders the N panes as rows inside the card. The
  // flat array stays the wire/PDF contract; grouping is UI-only.
  const groups = useMemo<MaterialRowGroup[]>(() => {
    const rows = form.materials_data || [];
    const byKey = new Map<string, MaterialRowGroup>();
    rows.forEach((mat, idx) => {
      if (!mat || !mat.name) return;
      const groupKey = materialGroupKey(mat);
      const group = byKey.get(groupKey);
      if (group) {
        group.rows.push({ mat, idx });
      } else {
        byKey.set(groupKey, { rows: [{ mat, idx }], groupKey });
      }
    });
    return [...byKey.values()];
  }, [form.materials_data]);

  return (
    <div className={cardClassName || 'card'}>
      <h3 className="section-title">MATERIALES</h3>
      <div className={s['specs-controls']}>
        <MaterialPickerControls
          materials={materials}
          categorias={categorias}
          readOnly={readOnly}
          onPick={(mat) => addMaterial(mat.name)}
        />
      </div>
      <div className={s['specs-materials-grid']}>
        {groups.map((group) => (
          <MaterialCard
            key={group.groupKey}
            rows={group.rows}
            readOnly={readOnly}
            materials={materials}
            categorias={categorias}
            updateMaterial={updateMaterial}
            updateMaterialGroup={updateMaterialGroup}
            removeMaterial={removeMaterial}
            removeGroup={removeMaterialGroup}
            addRow={addMaterialRow}
            onChangeMaterial={(mat) => swapMaterialGroup(group.rows.map((r) => r.idx), mat)}
            num={(v) => num(v as string) ?? 0}
            usdRate={Number(form.usd_rate) || 0}
          />
        ))}
      </div>
      {(form.materials_data || []).length === 0 && (
        <div className={s['specs-empty']}>
          Sin materials agregados. Usá "+ AGREGAR MATERIAL" para sumar.
        </div>
      )}
      <div className="form-group">
        <label>Observaciones del diseño</label>
        <textarea
          className="input"
          rows={4}
          value={form.design_observations}
          onChange={(e) => update('design_observations', e.target.value)}
          placeholder="Zócalo de 7 cm. Frente de 4 cm. Incluye 3 perforaciones..."
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
