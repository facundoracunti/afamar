/** "Additional Works" picker — UI for selecting items from the catalogue
 *  and listing them as cards (same visual pattern as PoolSection).
 *  Each card shows name, quantity, price, and an
 *  "Asignar a opción" dropdown to link it to a specific material. For
 *  `frente` rows the card switches to a metered input (linear meters +
 *  assigned material + live subtotal) instead of the legacy
 *  Cant / Precio pair.
 *
 *  When the catalogue contains a `Frente / Regrueso` row, the section
 *  also renders a second picker that mirrors the PoolSection pattern
 *  ("+ AGREGAR PILETA"). The dropdown lists each material currently on
 *  the budget (principal + alternativas) and creates a pre-filled
 *  frente row assigned to the selected material — bypassing the
 *  per-card "Asignar material" dropdown that operators tend to miss.
 */
import React from 'react';
import {
  useAdditionalWorksCatalogue,
  useAdditionalWorkSelection,
} from '../../../hooks/useAdditionalWorkSelection';
import { formatCurrencyValue } from '../../../utils/formatters';
import {
  buildFrenteSelectionFor,
  FRENTE_FORMULA_MULTIPLIER_DEFAULT,
} from '../../../utils/frentePricing';
// (dedup helper `buildMaterialGroupOptions` lives in
//  `utils/materialGroups.ts` — not consumed here while we keep the
//  historical per-pane picker behavior.)
import type { AdditionalWork } from '../../../types/additionalWork';
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
  /** Materials on the form (for the "Asignar a opción" dropdown and the
   *  "Asignar material" picker used by `frente` rows). */
  formMaterials?: MaterialInForm[];
}

export default function AdditionalWorkSection({ value, onChange, readOnly, formMaterials }: AdditionalWorkSectionProps) {
  const { items: catalogue, loading: catalogueLoading } = useAdditionalWorksCatalogue();
  const { selections, add, remove, removeAt, updateField, totalArs, totalUsd } =
    useAdditionalWorkSelection(value);

  React.useEffect(() => {
    onChange(JSON.stringify(selections));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections]);

  const selectedIds = new Set(
    selections.map((s) => s.additional_work_id).filter((id): id is number => id !== null)
  );

  const catalogueById = React.useMemo(() => {
    const map = new Map<number, AdditionalWork>();
    catalogue.forEach((c) => map.set(c.id, c));
    return map;
  }, [catalogue]);

  // Resolve the `Frente / Regrueso` catalogue row once it's loaded. Falls
  // back to a name match for legacy catalogue entries that predate the
  // `type` column.
  const frenteCatalogue = React.useMemo(
    () => catalogue.find((c) => c.type === 'frente') ?? catalogue.find((c) => /frente/i.test(c.name)),
    [catalogue],
  );

  const materials = formMaterials ?? [];

  const handleAdd = (rawId: string) => {
    const id = Number(rawId);
    if (!id) return;
    const item = catalogue.find((a) => a.id === id);
    if (!item) return;
    if (item.type === 'frente') {
      // `initialAssignedMaterialId` left null: operator picks the material
      // from the card's dropdown so the formula can resolve cleanly.
      add({ catalogueItem: item, quantity: 1, initialLinearMeters: 1, initialAssignedMaterialId: null });
    } else {
      add({ catalogueItem: item, quantity: 1 });
    }
  };

  /** Pre-fill a frente row tied to the picked material, then push it
   *  into the snapshot. Mirrors the UX of PoolSection's
   *  "+ AGREGAR PILETA" dropdown — the operator picks a material in
   *  one step instead of: add trabajo adicional → pick frente →
   *  open the card → assign to a material. */
  const handleAssignFrente = (rawKey: string) => {
    if (!frenteCatalogue) return;
    const mat = materials.find(
      (m) => String(m.id ?? m.name) === rawKey,
    );
    if (!mat) return;
    const pricePerM2 =
      mat.currency === 'USD'
        ? Number(mat.price_m2_usd ?? 0)
        : Number(mat.price_m2 ?? 0);
    const newRow = buildFrenteSelectionFor(
      {
        id: frenteCatalogue.id,
        name: frenteCatalogue.name,
        detail: frenteCatalogue.detail ?? null,
        currency: mat.currency === 'USD' ? 'USD' : 'ARS',
      },
      {
        id: mat.id ?? null,
        name: mat.name,
        price_per_m2: pricePerM2,
        currency: mat.currency === 'USD' ? 'USD' : 'ARS',
        is_alternative: !!mat.is_alternative,
      },
      frenteCatalogue.formula_constant ?? FRENTE_FORMULA_MULTIPLIER_DEFAULT,
    );
    onChange(JSON.stringify([...selections, newRow]));
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
              .filter((a) => !selectedIds.has(a.id) && a.type !== 'frente')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.type === 'frente' ? '* ' : ''}
                  {a.name} ({a.currency === 'USD' ? 'USD ' : '$ '}
                  {a.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) {a.type === 'frente' ? '[frente]' : ''}
                </option>
              ))}
          </select>

          {frenteCatalogue && materials.length > 0 ? (
            <select
              className={`input ${s['additional-works__add-frente-select']}`}
              value=""
              data-testid="assign-frente-to-material"
              onChange={(e) => {
                if (e.target.value) {
                  handleAssignFrente(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={readOnly}
              title="Asigna un costo de mano de obra (Frente / Regrueso) a un material específico de este presupuesto. Equivale a '+ AGREGAR PILETA' pero para frente."
            >
              <option value="">+ ASIGNAR FRENTE A MATERIAL</option>
              {materials
                .filter((m) => m && m.name)
                .map((m) => (
                  <option key={String(m.id ?? m.name)} value={String(m.id ?? m.name)}>
                    {m.is_alternative ? 'Alternativa: ' : 'Principal: '}
                    {m.name}
                  </option>
                ))}
            </select>
          ) : null}
        </div>
      )}

      {(selections || []).map((sel, idx) => {
        const catalogueItem = sel.additional_work_id != null ? catalogueById.get(sel.additional_work_id) ?? null : null;
        return (
          <AdditionalWorkCard
            key={idx}
            selection={sel}
            idx={idx}
            formMaterials={materials}
            readOnly={!!readOnly}
            catalogueItem={catalogueItem}
            updateAdditionalWork={updateField}
            removeAdditionalWork={(i) => {
              // Drop the row at index `i` (not by catalogue id) so
              // removing a frente tied to one material doesn't also drop
              // the frentes tied to other materials — all frentes share
              // the same catalogue id (e.g. 24) so id-based removal
              // would nuke every frente in one click.
              removeAt(i);
            }}
          />
        );
      })}

      {selections.length > 0 && (totalArs > 0 || totalUsd > 0) && (
        <div className={s['additional-works__totals']}>
          {totalArs > 0 && (
            <span>{formatCurrencyValue(totalArs, { currency: 'ARS' })}</span>
          )}
          {totalUsd > 0 && (
            <span>{formatCurrencyValue(totalUsd, { currency: 'USD' })}</span>
          )}
        </div>
      )}
    </div>
  );
}
