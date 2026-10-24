/**
 * `MaterialForm` — identity fields (nombre + categoría) and
 * catalog fields (color + espesor).
 */
import React from 'react';
import { FolderTree, Palette } from 'lucide-react';
import type { MaterialCategory } from '@/api/resources/materials';
import type { MaterialColor } from '../../../types/material';
import type { MaterialFormData } from '../../../types/material';
import styles from './MaterialForm.module.css';

const s = styles as unknown as Record<string, string>;

export type MaterialIdentityForm = Pick<
  MaterialFormData,
  'name' | 'category_id' | 'color_id' | 'available_thickness'
>;

export interface MaterialIdentityFieldsProps {
  form: MaterialIdentityForm;
  categorias: MaterialCategory[];
  colores: MaterialColor[];
  loadingCategories: boolean;
  loadingColors: boolean;
  navigate: (path: string) => void;
  onChange: (patch: Partial<MaterialFormData>) => void;
}

export function MaterialIdentityFields({
  form,
  categorias,
  colores,
  loadingCategories,
  loadingColors,
  navigate,
  onChange,
}: MaterialIdentityFieldsProps) {
  return (
    <>
      <div className={s['material-form__row']}>
        <div className={s['material-form__group']}>
          <label className={s['material-form__label']}>Nombre *</label>
          <input className="input" required value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className={s['material-form__group']}>
          <label className={s['material-form__label']}>
            Categoría *
            <a
              href="/admin/materials/categories"
              onClick={(e) => { e.preventDefault(); navigate('/admin/materials/categories'); }}
              className={s['material-form__label-link']}
              title="Gestionar categorías"
            >
              <FolderTree size={12} /> Gestionar
            </a>
          </label>
          <select
            className="input"
            value={form.category_id}
            onChange={(e) => onChange({ category_id: e.target.value })}
            disabled={loadingCategories && categorias.length === 0}
            required
          >
            <option value="">{loadingCategories ? 'Cargando categorías...' : 'Seleccionar...'}</option>
            {categorias.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
          {!loadingCategories && categorias.length === 0 && (
            <small className={s['material-form__warn-text']}>
              No hay categorías cargadas. Creá una desde "Gestionar Categorías" en el menú.
            </small>
          )}
        </div>
      </div>
      <div className={s['material-form__row']}>
        <div className={s['material-form__group']}>
          <label className={s['material-form__label']}>
            Color
            <a
              href="/admin/materials/colors"
              onClick={(e) => { e.preventDefault(); navigate('/admin/materials/colors'); }}
              className={s['material-form__label-link']}
              title="Gestionar colores"
            >
              <Palette size={12} /> Gestionar
            </a>
          </label>
          <select
            className="input"
            value={form.color_id}
            onChange={(e) => onChange({ color_id: e.target.value })}
            disabled={loadingColors && colores.length === 0}
          >
            <option value="">Sin color</option>
            {colores.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
          {!loadingColors && colores.length === 0 && (
            <small className={s['material-form__warn-text']}>
              No hay colores cargados. Creá uno desde "Gestionar Colores" en el menú.
            </small>
          )}
        </div>
        <div className={s['material-form__group']}>
          <label className={s['material-form__label']}>Espesor disponible</label>
          <input className="input" value={form.available_thickness} onChange={(e) => onChange({ available_thickness: e.target.value })} />
        </div>
      </div>
    </>
  );
}
