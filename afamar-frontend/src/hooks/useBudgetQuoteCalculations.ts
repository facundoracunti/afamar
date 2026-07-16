import { useMemo } from 'react';
import { t as translateConcept } from '../utils/translate';
import type { MaterialInForm, PoolInForm, EntityFormState } from '../types';

type BreakdownItem = { concept: string; quantity: number; total: number; currency: 'ARS' | 'USD' };

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
      detalleTrabajosComunes.push({ concept: baseLabel, quantity: Number(item.quantity || 1), total: totalItem, currency: itemCurrency });
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
      });
    }
  }

  return { sumatoriaAdicionalesARS, detalleTrabajosComunes };
}

export function useBudgetQuoteCalculations({ form, hayAlternativas }: BudgetCalcParams): BudgetQuoteCalculations {
  const dd2 = Number(form.usd_rate) || 1;

  const { sumatoriaAdicionalesARS, detalleTrabajosComunes } = useMemo(
    () => computeBreakdown(form, dd2),
    [form.fabrication_details, form.pools_data, form.transport, dd2],
  );

  const matsMain = useMemo(
    () => ((form.materials_data as unknown as MaterialInForm[]) || []).filter((m) => !m.is_alternative),
    [form.materials_data],
  );

  const matsAlt = useMemo(
    () => ((form.materials_data as unknown as MaterialInForm[]) || []).filter((m) => m.is_alternative),
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
