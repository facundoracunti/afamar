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
import { buildMaterialGroupOptions, materialGroupKey } from '../../../utils/materialGroups';
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
    const { selections, add, removeAt, updateField, totalArs, totalUsd } =
      useAdditionalWorkSelection(value, onChange);

  const selectedIds = new Set(
    selections.map((s) => s.additional_work_id).filter((id): id is number => id !== null)
  );

  const catalogueById = React.useMemo(() => {
    const map = new Map<number, AdditionalWork>();
    catalogue.forEach((c) => map.set(c.id, c));
    return map;
  }, [catalogue]);

  // Resolve the `Frente / Regrueso` catalogue rows. There can be more than
  // one (e.g. "Frente Ingletetado 45°" + "Frente Doble"), so we use *all*
  // matches instead of `find()` to support operator choice across the
  // different frente formulas.
  const frenteCatalogues = React.useMemo(
    () => catalogue.filter((c) => c.type === 'frente' || /frente/i.test(c.name)),
    [catalogue],
  );

  const materials = formMaterials ?? [];

  // One option per *physical* material (a card may hold N panes/rows of
  // the same material — the flat `materials_data` would otherwise render
  // N identical entries in the dropdown).
  const materialGroups = React.useMemo(
    () => buildMaterialGroupOptions(formMaterials ?? []),
    [formMaterials],
  );

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
   *  open the card → assign to a material.
   *
   *  The frente catalogue is passed in via the key prefix
   *  (`fr:<id>:<materialKey>`) so the operator can pick which frente
   *  formula to use when there are multiple rows in the catalogue. */
  const handleAssignFrente = (rawKey: string) => {
    if (!rawKey.startsWith('fr:')) return;
    const [, frenteId, ...rest] = rawKey.split(':');
    const matKey = rest.join(':');
    const frente = frenteCatalogues.find((f) => String(f.id) === frenteId);
    if (!frente) return;
    const group = materialGroups.find((g) => g.groupKey === matKey);
    const mat = group ? materials.find((m) => materialGroupKey(m) === group.groupKey) : undefined;
    if (!mat) return;
    const pricePerM2 =
      mat.currency === 'USD'
        ? Number(mat.price_m2_usd ?? 0)
        : Number(mat.price_m2 ?? 0);
    const newRow = buildFrenteSelectionFor(
      {
        id: frente.id,
        name: frente.name,
        detail: frente.detail ?? null,
        currency: mat.currency === 'USD' ? 'USD' : 'ARS',
      },
      {
        id: mat.id ?? null,
        name: mat.name,
        price_per_m2: pricePerM2,
        currency: mat.currency === 'USD' ? 'USD' : 'ARS',
        is_alternative: group?.isAlternative ?? !!mat.is_alternative,
      },
      frente.formula_constant ?? FRENTE_FORMULA_MULTIPLIER_DEFAULT,
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
              // Flat items: dedup by catalogue id (one row per selected id).
              // Frente items: keep dedup-by-id as well — the card already
              // supports the "Asignar material" dropdown so the operator
              // can add the same frente twice and bind each copy to a
              // different material. (Multi-add for frentes is handled by
              // the "ASIGNAR FRENTE A MATERIAL" shortcut below.)
              .filter((a) => !selectedIds.has(a.id))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.type === 'frente' ? '★ ' : ''}
                  {a.name} ({a.currency === 'USD' ? 'USD ' : '$ '}
                  {a.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) {a.type === 'frente' ? '[frente]' : ''}
                </option>
              ))}
          </select>

          {frenteCatalogues.length > 0 && materials.length > 0 ? (
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
              title="Asigna un costo de mano de obra (Frente / Regrueso) a un material específico de este presupuesto. Si hay más de un frente configurado, elegí cuál."
            >
              <option value="">+ ASIGNAR FRENTE A MATERIAL</option>
              {frenteCatalogues.flatMap((frente) =>
                materialGroups.map((g) => (
                  <option key={`fr:${frente.id}:${g.groupKey}`} value={`fr:${frente.id}:${g.groupKey}`}>
                    {frente.name} → {g.label}
                  </option>
                )),
              )}
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
