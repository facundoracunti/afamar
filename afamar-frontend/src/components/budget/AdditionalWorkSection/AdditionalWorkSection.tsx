/** "Additional Works" picker — UI for selecting items from the catalogue
 *  and listing them as cards (same visual pattern as PoolSection).
 *  Each card shows name, quantity, price, and an
 *  "Asignar a opción" dropdown to link it to a specific material. */
import React from 'react';
import {
  useAdditionalWorksCatalogue,
  useAdditionalWorkSelection,
} from '../../../hooks/useAdditionalWorkSelection';
import type { MaterialInForm } from '../../../types/budget';
import AdditionalWorkCard from '../AdditionalWorkCard/AdditionalWorkCard';
import styles from './AdditionalWorkSection.module.css';

const s = styles as unknown as Record<string, string>;

interface AdditionalWorkSectionProps {
  /** JSON-encoded selection from the form (parses on mount). */
  value: string | null | undefined;
  /** Notify the parent when the selection changes. */
  onChange: (json: string) => void;
  /** Read-only flag for printed / locked budgets. */
  readOnly?: boolean;
  /** Materials on the form (for the "Asignar a opción" dropdown). */
  formMaterials?: MaterialInForm[];
}

export default function AdditionalWorkSection({ value, onChange, readOnly, formMaterials }: AdditionalWorkSectionProps) {
  const { items: catalogue, loading: catalogueLoading } = useAdditionalWorksCatalogue();
  const { selections, add, remove, updateField, totalArs, totalUsd } =
    useAdditionalWorkSelection(value);

  React.useEffect(() => {
    onChange(JSON.stringify(selections));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections]);

  const selectedIds = new Set(
    selections.map((s) => s.additional_work_id).filter((id): id is number => id !== null)
  );

  const handleAdd = (rawId: string) => {
    const id = Number(rawId);
    if (!id) return;
    const item = catalogue.find((a) => a.id === id);
    if (!item) return;
    add(item, 1);
  };

  return (
    <div className="card">
      <h3 className="section-title">TRABAJO ADICIONAL</h3>

      {catalogueLoading ? (
        <div className={s['additional-works__loading']}>Cargando catálogo...</div>
      ) : catalogue.length === 0 ? (
        <div className={s['additional-works__empty']}>
          No hay trabajos adicionales configurados. El operador puede crearlos en{' '}
          <a href="/admin/additional-works" target="_blank" rel="noreferrer">/admin/additional-works</a>.
        </div>
      ) : (
        <div className={s['additional-works__picker']}>
          <select
            className={`input ${s['additional-works__add-select']}`}
            value=""
            onChange={(e) => {
              if (e.target.value) {
                handleAdd(e.target.value);
                e.target.value = '';
              }
            }}
            disabled={readOnly}
          >
            <option value="">+ AGREGAR TRABAJO ADICIONAL</option>
            {catalogue
              .filter((a) => !selectedIds.has(a.id))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency === 'USD' ? 'USD ' : '$ '}
                  {a.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                </option>
              ))}
          </select>
        </div>
      )}

      {(selections || []).map((s, idx) => (
        <AdditionalWorkCard
          key={s.additional_work_id ?? idx}
          selection={s}
          idx={idx}
          formMaterials={formMaterials ?? []}
          readOnly={!!readOnly}
          updateAdditionalWork={updateField}
          removeAdditionalWork={(i) => {
            const target = selections[i];
            if (target) remove(target.additional_work_id);
          }}
        />
      ))}

      {selections.length > 0 && (totalArs > 0 || totalUsd > 0) && (
        <div className={s['additional-works__totals']}>
          {totalArs > 0 && (
            <span>$ {totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          )}
          {totalUsd > 0 && (
            <span>USD {totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          )}
        </div>
      )}
    </div>
  );
}
