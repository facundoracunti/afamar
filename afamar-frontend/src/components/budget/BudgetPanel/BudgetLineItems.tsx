import React from 'react';
import { formatCurrencyValue } from '../../../utils/formatters';
import { t } from '../../../utils/translate';
import type { EntityFormState } from '../../../types/form';
import type { FabricationDetail, MaterialInForm, PoolInForm } from '../../../types/budget';
import { parseAdditionalWorksData } from '../../../utils/additionalWorkParse';
import styles from './BudgetPanel.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetLineItemsProps {
  form: EntityFormState;
  fabricationDetails: FabricationDetail[];
  materials: MaterialInForm[];
  pools: PoolInForm[];
}

/** Item genérico: CONCEPTO (label izquierda) + SUBTOTAL (valor
 *  nativa en el pill + conversión en la otra moneda debajo). Mismo
 *  patrón visual que el detail box del alternative card. */
function DetailRow({
  label,
  displayValue,
  arsEquivalent,
  usdTotal,
  nativeCurrency,
  isDashed = false,
}: {
  label: string;
  /** Valor en la moneda nativa (lo que va en el pill verde/blanco). */
  displayValue: number;
  /** Mismo valor expresado en ARS — se usa para la conversión cuando
   *  `nativeCurrency === 'USD'` (debajo del pill). */
  arsEquivalent: number;
  /** Mismo valor expresado en USD — se usa para la conversión cuando
   *  `nativeCurrency === 'ARS'`. */
  usdTotal: number;
  nativeCurrency: 'ARS' | 'USD';
  isDashed?: boolean;
}) {
  if (!Number.isFinite(displayValue) || displayValue <= 0) return null;
  const valueClass = nativeCurrency === 'USD'
    ? `${s['budget-panel__detail-value']} ${s['budget-panel__detail-value--usd']}`
    : s['budget-panel__detail-value'];
  const usdRefClass = nativeCurrency === 'USD'
    ? `${s['budget-panel__detail-value-usd']} ${s['budget-panel__detail-value-usd--light']}`
    : `${s['budget-panel__detail-value-usd']}`;
  return (
    <div className={`${s['budget-panel__detail-row']} ${isDashed ? s['budget-panel__detail-row--dashed'] : ''}`}>
      <span className={s['budget-panel__detail-label']}>{label}</span>
      <span>
        <span className={valueClass}>
          {nativeCurrency === 'USD'
            ? formatCurrencyValue(displayValue, { currency: 'USD' })
            : formatCurrencyValue(displayValue, { currency: 'ARS' })}
        </span>
        <span className={usdRefClass}>
          ≈ {nativeCurrency === 'USD'
            ? formatCurrencyValue(arsEquivalent, { currency: 'ARS', decimals: 2 })
            : formatCurrencyValue(usdTotal, { currency: 'USD' })}
        </span>
      </span>
    </div>
  );
}

export function BudgetLineItems({ form, fabricationDetails, materials, pools }: BudgetLineItemsProps) {
  // Parse the additional-works snapshot once here so the summary list
  // and `useBudgetCalculations` share one canonical parser.
  const additionalWorks = parseAdditionalWorksData(form.additional_works_data);
  const dd = Number(form.usd_rate);

  // Set con los nombres de los materiales marcados como alternativos.
  // Los pools/fabrication/additional-works cuyo `material` (o
  // `materialName` con prefijo `__ALT__:`) apunte a uno de estos se
  // renderizan SOLO en la card de la alternativa correspondiente, no en
  // el Presupuesto principal. Usamos `form.materials_data` (todos los
  // materiales), NO `materials` (que BudgetPanel ya filtra a main-only).
  const altMaterialNames = new Set(
    (form.materials_data ?? []).filter((m) => m.is_alternative).map((m) => m.name),
  );

  /** Devuelve true si el item está atado a un material alternativo
   *  (debe ocultarse del Presupuesto principal). */
  const isTiedToAlternative = (materialField: string | null | undefined): boolean => {
    if (!materialField) return false;
    if (materialField === '__GLOBAL__') return false;
    if (materialField.startsWith('__ALT__:')) return true;
    return altMaterialNames.has(materialField);
  };

  // Filtrar pools/fabrication/additionals atados a un alternativo
  const poolsForMain = pools.filter((pt) => !isTiedToAlternative(pt.material));
  const fabricationForMain = fabricationDetails.filter((d) => !isTiedToAlternative(d.material));
  const additionalForMain = additionalWorks.filter((a) => !isTiedToAlternative(a.materialName));

  return (
    <div className={s['budget-panel__detail-box']}>
      <div className={s['budget-panel__detail-header']}>
        <span>Concepto</span>
        <span>Subtotal</span>
      </div>

      {/* Fabricación */}
      {fabricationForMain
        .filter((d) => Number(d.price) > 0)
        .map((d, i) => {
          const nativeCurrency = d.currency === 'USD' ? 'USD' : 'ARS';
          const nativePrice = Number(d.price);
          const arsTotal = nativeCurrency === 'ARS' ? nativePrice * d.quantity : (dd > 0 ? nativePrice * dd * d.quantity : 0);
          const usdTotal = nativeCurrency === 'USD' ? nativePrice * d.quantity : (dd > 0 ? (nativePrice * d.quantity) / dd : 0);
          const isGlobal = !d.material;
          const globalTag = isGlobal ? ' [GLOBAL]' : '';
          const label = `${d.concept === 'OTHER' ? d.detail || t('OTHER') : t(d.concept)}${d.material ? ` - ${d.material}` : ''}${d.m2 > 0 ? ` (${d.m2} m²)` : ''}${d.length && d.length > 0 && d.concept === 'OTHER' ? ` (${d.length} m)` : ''}${d.quantity > 1 ? ` x${d.quantity}` : ''}${globalTag}`;
          return (
            <DetailRow
              key={`${d.concept}-${d.detail ?? ''}-${d.currency}-${i}`}
              label={label}
              displayValue={nativeCurrency === 'ARS' ? arsTotal : usdTotal}
              arsEquivalent={arsTotal}
              usdTotal={usdTotal}
              nativeCurrency={nativeCurrency}
            />
          );
        })}

      {/* Materiales */}
      {materials.map((m, i) => {
        const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
        const nativeCurrency = m.currency === 'USD' ? 'USD' : 'ARS';
        const subArs = nativeCurrency === 'ARS' ? m2 * (m.price_m2 || 0) : (dd > 0 ? m2 * (m.price_m2_usd || 0) * dd : 0);
        const subUsd = nativeCurrency === 'USD' ? m2 * (m.price_m2_usd || 0) : (dd > 0 ? (m2 * (m.price_m2 || 0)) / dd : 0);
        if (subArs <= 0 && subUsd <= 0) return null;
        const nativeTotal = nativeCurrency === 'ARS' ? subArs : subUsd;
        const usdTotal = nativeCurrency === 'USD' ? subUsd : (dd > 0 ? subArs / dd : 0);
        const label = `${m.name} (${m2.toFixed(3)} m²)${m.quantity > 1 ? ` x${m.quantity}` : ''}`;
        return (
          <DetailRow
            key={m.id ?? `m-${m.name ?? 'unnamed'}-${i}`}
            label={label}
            displayValue={nativeTotal}
            arsEquivalent={subArs}
            usdTotal={usdTotal}
            nativeCurrency={nativeCurrency}
          />
        );
      })}

      {/* Piletas */}
      {poolsForMain.map((pt, i) => {
        const nativeCurrency = pt.currency === 'USD' ? 'USD' : 'ARS';
        const arsTotal = nativeCurrency === 'ARS' ? (pt.price || 0) * (pt.quantity || 1) : (dd > 0 ? (pt.price || 0) * dd * (pt.quantity || 1) : 0);
        const usdTotal = nativeCurrency === 'USD' ? (pt.price || 0) * (pt.quantity || 1) : (dd > 0 ? ((pt.price || 0) * (pt.quantity || 1)) / dd : 0);
        const nativeTotal = nativeCurrency === 'ARS' ? arsTotal : usdTotal;
        const usdRef = nativeCurrency === 'USD' ? usdTotal : (dd > 0 ? arsTotal / dd : 0);
        const isGlobal = pt.material === '__GLOBAL__' || !pt.material;
        const globalTag = isGlobal ? ' [GLOBAL]' : '';
        const label = `Pileta ${pt.brand} - ${pt.model}${pt.quantity > 1 ? ` (x${pt.quantity})` : ''}${globalTag}`;
        return (
          <DetailRow
            key={pt.pool_id ?? `p-${pt.brand ?? 'unnamed'}-${pt.model ?? 'unnamed'}-${i}`}
            label={label}
            displayValue={nativeTotal}
            arsEquivalent={arsTotal}
            usdTotal={usdRef}
            nativeCurrency={nativeCurrency}
          />
        );
      })}

      {/* Trabajos adicionales */}
      {additionalForMain.map((a, i) => {
        const nativeTotal =
          a.type === 'frente'
            ? Number(a.total ?? 0)
            : Number(a.total ?? Number(a.price ?? 0) * Number(a.quantity ?? 1));
        if (!Number.isFinite(nativeTotal) || nativeTotal <= 0) return null;
        const nativeCurrency: 'ARS' | 'USD' = a.currency === 'USD' ? 'USD' : 'ARS';
        const arsTotal = nativeCurrency === 'ARS' ? nativeTotal : (dd > 0 ? nativeTotal * dd : 0);
        const usdTotal = nativeCurrency === 'USD' ? nativeTotal : (dd > 0 ? nativeTotal / dd : 0);
        const linearLabel = a.type === 'frente' && a.linear_meters && a.linear_meters > 0 ? ` (${a.linear_meters} ml)` : '';
        const qtyLabel = a.type !== 'frente' && a.quantity > 1 ? ` x${a.quantity}` : '';
        const detalle = a.detail ? ` - ${a.detail}` : '';
        const frenteTag = a.type === 'frente' ? ' [Frente]' : '';
        const isGlobal = a.materialName === '__GLOBAL__' || (!a.materialName && a.type !== 'frente');
        const globalTag = isGlobal ? ' [GLOBAL]' : '';
        const label = `${a.name}${detalle}${linearLabel}${qtyLabel}${globalTag}${frenteTag}`;
        return (
          <DetailRow
            key={`aw-${a.additional_work_id ?? 'aw'}-${i}`}
            label={label}
            displayValue={nativeCurrency === 'ARS' ? nativeTotal : usdTotal}
            arsEquivalent={arsTotal}
            usdTotal={usdTotal}
            nativeCurrency={nativeCurrency}
            isDashed
          />
        );
      })}
    </div>
  );
}