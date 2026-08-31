import { useMemo } from 'react';
import { t as translateConcept } from '../utils/translate';
import { materialGroupKey } from '../utils/materialGroups';
import type { MaterialInForm, PoolInForm, EntityFormState } from '../types';

type BreakdownItem = {
  concept: string;
  quantity: number;
  total: number;
  currency: 'ARS' | 'USD';
  /** Link al material al que pertenece este row:
   *   - null/undefined → trabajo común (aparece en main + en TODAS las alts)
   *   - '__GLOBAL__'  → global (aparece en main + en TODAS las alts)
   *   - '<name>'      → atado a ese material (solo aparece en su card) */
  materialName?: string | null;
};

interface BudgetCalcParams {
  form: EntityFormState;
  hayAlternativas: boolean;
}

interface BudgetQuoteCalculations {
  sumatoriaAdicionalesARS: number;
  detalleTrabajosComunes: BreakdownItem[];
  principalesBreakdown: BreakdownItem[];
  matsMain: MaterialInForm[];
  matsAlt: MaterialInForm[];
  sumatoriaMaterialesPrincipalARS: number;
}

function computeBreakdown(
  form: EntityFormState,
  dd2: number,
): { sumatoriaAdicionalesARS: number; detalleTrabajosComunes: BreakdownItem[] } {
  let sumatoriaAdicionalesARS = Number(form.transport || 0);
  const detalleTrabajosComunes: BreakdownItem[] = [];

  if (Number(form.transport || 0) > 0) {
    detalleTrabajosComunes.push({ concept: 'Traslado', quantity: 1, total: Number(form.transport), currency: 'ARS' });
  }

  for (const item of form.fabrication_details || []) {
    const totalItem = Number(item.price || 0) * Number(item.quantity || 1);
    const itemCurrency = (item.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
    const totalItemARS = itemCurrency === 'USD' ? (dd2 > 0 ? totalItem * dd2 : 0) : totalItem;
    if (totalItem > 0) {
      sumatoriaAdicionalesARS += totalItemARS;
      const baseLabel = item.concept === 'OTHER' && item.detail
        ? translateConcept('OTHER') + ' - ' + (item.detail as string)
        : translateConcept(item.concept as string);
      detalleTrabajosComunes.push({
        concept: baseLabel,
        quantity: Number(item.quantity || 1),
        total: totalItem,
        currency: itemCurrency,
        materialName: (item.material as string | null | undefined) || null,
      });
    }
  }

  for (const pil of form.pools_data || []) {
    const pool = pil as unknown as PoolInForm & Record<string, unknown>;
    const totalPil = Number(pool.price || 0) * Number(pool.quantity || 1);
    const poolCurrency = (pool.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
    const totalPilARS = poolCurrency === 'USD' ? (dd2 > 0 ? totalPil * dd2 : 0) : totalPil;
    if (totalPil > 0) {
      sumatoriaAdicionalesARS += totalPilARS;
      detalleTrabajosComunes.push({
        concept: `Pileta ${(pool.brand as string) || ''} ${(pool.model as string) || ''}`.trim(),
        quantity: Number(pool.quantity || 1),
        total: totalPil,
        currency: poolCurrency,
        materialName: (pool.material as string | null | undefined) || null,
      });
    }
  }

  return { sumatoriaAdicionalesARS, detalleTrabajosComunes };
}

/** Collapse multiple `materials_data` rows of the SAME physical material
 *  (same catalogue id, `name:<id>` legacy fallback) into a single row, while
 *  AGGREGATING the pile info — total piece count and total m² — so the option
 *  card (and its cost, which is derived from `length × width × quantity`)
 *  reflects ALL panes, not just the first one.
 *
 *  A representative is kept for the material identity; its `quantity` becomes
 *  the total piece count across the group and its dimensions are re-encoded so
 *  that the downstream `l × w × qty` reconstruction still equals the group's
 *  total m² (i.e. `cost` stays correct). Order follows first occurrence. */
function dedupeMaterials(materials: MaterialInForm[]): MaterialInForm[] {
  const groups = new Map<string, MaterialInForm[]>();
  for (const m of materials) {
    const key = materialGroupKey(m);
    const g = groups.get(key);
    if (g) g.push(m);
    else groups.set(key, [m]);
  }
  const out: MaterialInForm[] = [];
  for (const [, group] of groups) {
    const rep = { ...group[0] };
    if (group.length === 1) {
      out.push(rep);
      continue;
    }
    const totalM2 = group.reduce(
      (s, m) => s + Number(m.length || 0) * Number(m.width || 0) * Number(m.quantity || 1),
      0,
    );
    const totalQty = group.reduce((s, m) => s + Number(m.quantity || 1), 0);
    rep.quantity = totalQty;
    rep.length = totalM2 / totalQty;
    rep.width = 1;
    out.push(rep);
  }
  return out;
}

export function useBudgetQuoteCalculations({ form, hayAlternativas }: BudgetCalcParams): BudgetQuoteCalculations {
  const dd2 = Number(form.usd_rate) || 1;

  const { sumatoriaAdicionalesARS, detalleTrabajosComunes } = useMemo(
    () => computeBreakdown(form, dd2),
    [form.fabrication_details, form.pools_data, form.transport, dd2],
  );

  const matsMain = useMemo(
    () => (form.materials_data || []).filter((m) => !m.is_alternative),
    [form.materials_data],
  );

  // One card per PHYSICAL material, not per pane: multiple `materials_data`
  // rows for the same alternative material (e.g. two planchas of BLANCO
  // SUGGAR) must collapse into a single card — exactly like the PDF section
  // builder (`buildSectionData` groups by `materialGroupKey`). Otherwise the
  // grid would render one extra card per duplicate pane.
  const matsAlt = useMemo(
    () => dedupeMaterials((form.materials_data || []).filter((m) => m.is_alternative)),
    [form.materials_data],
  );

  const principalesBreakdown = useMemo(() => {
    if (!hayAlternativas) return [];
    const items: BreakdownItem[] = [];
    for (const m of matsMain) {
      const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
      const costoMat = m.currency === 'USD' ? m2 * (m.price_m2_usd || 0) : m2 * (m.price_m2 || 0);
      const mCurrency = (m.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
      if (costoMat > 0) {
        items.push({
          concept: `Material Principal — ${m.name || ''}${m.color ? ' (' + m.color + ')' : ''}`,
          quantity: m.quantity || 1,
          total: costoMat,
          currency: mCurrency,
        });
      }
    }
    return items;
  }, [hayAlternativas, matsMain]);

  const sumatoriaMaterialesPrincipalARS = useMemo(() => {
    return matsMain.reduce((sum, m) => {
      const ddLocal = Number(form.usd_rate) || 1;
      const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
      const costoMat = m.currency === 'USD' ? m2 * (m.price_m2_usd || 0) : m2 * (m.price_m2 || 0);
      const costoMatArs = m.currency === 'USD' ? (ddLocal > 0 ? costoMat * ddLocal : 0) : costoMat;
      return sum + costoMatArs;
    }, 0);
  }, [matsMain, form.usd_rate]);

  return {
    sumatoriaAdicionalesARS,
    detalleTrabajosComunes,
    principalesBreakdown,
    matsMain,
    matsAlt,
    sumatoriaMaterialesPrincipalARS,
  };
}
