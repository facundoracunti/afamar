import React, { useState } from 'react';
import { Copy, Plus, Trash2, Check } from 'lucide-react';
import { useBudgetOptions } from './BudgetOptionsContext';
import { SINGLE_OPTION_ID } from './budgetOptions';
import { fmtMoney } from '@/utils/pdf/pdfHelpers';
import type { BudgetOption } from '../../../types/budget';
import styles from './BudgetOptionsTabs.module.css';

const s = styles as unknown as Record<string, string>;

/**
 * OPTIONES DEL PRESUPUESTO — tab bar for multi-option (multi-escenario)
 * budgets (2026-10-01 Fase 2).
 *
 * Each tab owns a complete, independent quote scenario (its own pieces,
 * materials, piletas and adicionales), so the customer can compare
 * "Opción 1 = Calacatta + JOHNSON" against "Opción 2 = full Negro
 * Brasil" — even crossing materials between a mesada and an alzada.
 *
 * Only rendered when the budget really has more than one option: a legacy
 * single-option budget (and a single-option new budget) keeps the exact
 * UI it had before, so existing documents look unchanged.
 *
 * The ★ / "✓" marks the WINNING option — the one a conversion to a work
 * order will use. It is separate from "which tab am I editing", so the
 * operator can browse the variants without accidentally re-pointing the
 * conversion.
 */
export function BudgetOptionsTabs() {
  const opts = useBudgetOptions();
  const [renaming, setRenaming] = useState<string | null>(null);

  // Only the BUDGET form mounts the provider, so a non-null context
  // already means "this is a budget". The bar is therefore ALWAYS
  // rendered — including for a brand-new budget or a legacy one with a
  // single implicit option — because the operator must always be able to
  // see the options and press "+ Agregar Opción". Hiding it when there
  // is a single option made the whole feature unreachable.
  if (!opts) return null;

  const {
    options,
    activeOptionId,
    setActiveOptionId,
    addOption,
    duplicateOption,
    removeOption,
    renameOption,
    selectOption,
    optionSubtotals,
  } = opts;

  // Subtotal of each option — priced with the PDF's own helper, so the
  // number the operator reads here is EXACTLY the number the customer
  // is quoted in the "Resumen Comparativo de Opciones".
  const subtotalOf = (id: string): { ars: number; usd: number } | null => {
    if (options.length === 0) return null;
    return optionSubtotals.find((s) => s.id === id) ?? null;
  };

  // Legacy / not-yet-multi-option budgets have no stored option row; show
  // the implicit one ("Opción 1") so the bar is never empty and the
  // add/duplicate actions always have something to clone. Note the label is
  // "Opción 1" (NOT the backend fallback name "Opción Única"): from the
  // operator's point of view the single configuration IS option 1, and
  // pressing "+ Agregar Opción" produces "Opción 2".
  const displayOptions: BudgetOption[] =
    options.length > 0
      ? options
      : [
          {
            id: SINGLE_OPTION_ID,
            name: 'Opción 1',
            is_selected: true,
            pieces: opts.activePieces,
          },
        ];
  const displayActiveId =
    options.length > 0 ? activeOptionId : SINGLE_OPTION_ID;

  return (
    <div className={s['opt-tabs']}>
      <div className={s['opt-tabs__bar']}>
        {displayOptions.map((o) => {
          const active = o.id === displayActiveId;
          return (
            <div
              key={o.id}
              className={`${s['opt-tab']}${active ? ' ' + s['opt-tab--active'] : ''}`}
            >
              {renaming === o.id ? (
                <input
                  className={`input ${s['opt-tab__rename']}`}
                  autoFocus
                  defaultValue={o.name}
                  onBlur={(e) => {
                    renameOption(o.id, e.target.value.trim() || o.name);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameOption(o.id, e.currentTarget.value.trim() || o.name);
                      setRenaming(null);
                    }
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  aria-label={`Renombrar ${o.name}`}
                />
              ) : (
                <button
                  type="button"
                  className={s['opt-tab__label']}
                  onClick={() => setActiveOptionId(o.id)}
                  onDoubleClick={() => setRenaming(o.id)}
                  title={`Editando ${o.name} — doble click para renombrar`}
                >
                  {o.name}
                </button>
              )}

              {/* Per-option subtotal — same helper the PDF uses, so the
                  operator's number and the customer's quote can never
                  disagree. */}
              {(() => {
                const sub = subtotalOf(o.id);
                if (!sub || (sub.ars === 0 && sub.usd === 0)) return null;
                return (
                  <span className={s['opt-tab__subtotal']}>
                    {fmtMoney(sub.ars)}
                    {sub.usd > 0 ? ` · USD ${fmtMoney(sub.usd)}` : ''}
                  </span>
                );
              })()}

              {/* Winner marker (what a conversion will use). */}
              <button
                type="button"
                className={`${s['opt-tab__star']}${o.is_selected ? ' ' + s['opt-tab__star--on'] : ''}`}
                onClick={() => selectOption(o.id)}
                disabled={o.is_selected}
                title={
                  o.is_selected
                    ? 'Opción ganadora (la que se convierte en Orden de Trabajo)'
                    : 'Marcar como opción ganadora'
                }
                aria-label={`Marcar ${o.name} como ganadora`}
              >
                <Check size={12} />
              </button>

              <button
                type="button"
                className={s['opt-tab__action']}
                onClick={() => duplicateOption(o.id)}
                title={`Duplicar ${o.name} (copia medidas, piezas y piletas) para cambiar solo un dato (material o bacha)`}
                aria-label={`Duplicar ${o.name}`}
              >
                <Copy size={12} />
              </button>

              {/* Remove only makes sense once there is more than one real option —
                  a legacy/single-option budget keeps its one implicit
                  configuration and must not be deletable. */}
              {options.length > 1 ? (
                <button
                  type="button"
                  className={s['opt-tab__action']}
                  onClick={() => removeOption(o.id)}
                  title={`Quitar ${o.name}`}
                  aria-label={`Quitar ${o.name}`}
                >
                  <Trash2 size={12} />
                </button>
              ) : null}
            </div>
          );
        })}

        {/* "+ Agregar Opción" — creates a NEW EMPTY option so the operator
            can quote a scenario built from scratch. Cloning the current
            configuration is the explicit ❐ action of the tab. The tooltip
            + the hint below spell both apart so neither is a surprise. */}
        <button
          type="button"
          className={`btn btn-outline ${s['opt-tabs__add']}`}
          onClick={addOption}
          title="Crea una nueva opción vacía para cotizar un escenario desde cero"
        >
          <Plus size={12} /> Agregar Opción
        </button>
      </div>

      {options.length > 1 ? (
        <p className={s['opt-tabs__hint']}>
          Cada opción es independiente (piezas, materiales y piletas propios).{' '}
          <strong>«Agregar Opción» crea una opción vacía</strong> para cotizar un
          escenario desde cero, y el botón ❐{' '}
          <strong>duplica la que estás editando</strong> (mismas medidas, piezas y
          piletas) para cambiar solo lo que distingue a la variante (por ejemplo,
          el material de la alzada). La marcada con ✓ es la que se convierte en
          Orden de Trabajo.
        </p>
      ) : (
        <p className={s['opt-tabs__hint']}>
          Todavía tenés una sola opción.{' '}
          <strong>«Agregar Opción» crea una opción vacía</strong> para cotizar un
          escenario desde cero; el botón ❐{' '}
          <strong>duplica la que estás editando</strong> (mismas piezas, materiales y
          piletas) si solo querés cambiar un dato.
        </p>
      )}
    </div>
  );
}

export default BudgetOptionsTabs;