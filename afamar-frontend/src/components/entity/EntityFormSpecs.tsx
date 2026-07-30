import React, { useState, useMemo } from 'react';
import MaterialCard from '../../components/materials/MaterialCard/MaterialCard';
import { useList } from '../../api/hooks';
import { getMaterialCategories, type MaterialCategory } from '../../api/resources/materials';
import type { EntityFormState } from '../../types';
import type { Material } from '../../types/material';
import styles from './EntityFormSpecs.module.css';

const s = styles as unknown as Record<string, string>;

interface EntityFormSpecsProps {
  form: EntityFormState;
  readOnly: boolean;
  materials: Material[];
  addMaterial: (name: string) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  removeMaterial: (idx: number) => void;
  update: (field: string, value: unknown) => void;
  num: (v: string) => number | null;
  cardClassName?: string;
}

export default function EntityFormSpecs({
  form,
  readOnly,
  materials,
  addMaterial,
  updateMaterial,
  removeMaterial,
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const filteredMaterials = useMemo(() => {
    if (!selectedCategoryId) return materials;
    return materials.filter((m) => String(m.category_id ?? '') === selectedCategoryId);
  }, [materials, selectedCategoryId]);

  return (
    <div className={cardClassName || 'card'}>
      <h3 className="section-title">MATERIALES</h3>
      <div className="form-group">
        <select
          className="input"
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          disabled={readOnly}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <select className="input" value="" onChange={(e) => { addMaterial(e.target.value); e.target.value = ''; }} disabled={readOnly}>
          <option value="">+ AGREGAR MATERIAL</option>
          {filteredMaterials.filter((m) => m.name).map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}{m.color ? ` - ${m.color}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className={s['specs-materials-grid']}>
        {(form.materials_data || []).map((mat, idx) => (
          <MaterialCard
            key={idx}
            mat={mat}
            idx={idx}
            readOnly={readOnly}
            updateMaterial={updateMaterial}
            removeMaterial={removeMaterial}
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
