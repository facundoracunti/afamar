import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { CurrencyDisplay } from '../../ui/CurrencyDisplay/CurrencyDisplay';
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

export function BudgetLineItems({ form, fabricationDetails, materials, pools }: BudgetLineItemsProps) {
  // Parse the additional-works snapshot once here so the summary list
  // and `useBudgetCalculations` share one canonical parser. Earlier
  // this component never read `additional_works_data` at all, so the
  // resumen line list was missing the cards even though the totals
  // (which use the same parser) included them.
  const additionalWorks = parseAdditionalWorksData(form.additional_works_data);
  const dd = Number(form.usd_rate);

  return (
    <div className={s['budget-panel__subtotal-block']}>
      {fabricationDetails
        .filter((d) => Number(d.price) > 0)
        .map((d, i) => {
          const precioArs =
            d.currency === 'ARS' ? Number(d.price)
              : dd > 0 ? Number(d.price) * dd : 0;
          const precioUsd =
            d.currency === 'USD' ? Number(d.price)
              : dd > 0 ? Number(d.price) / dd : 0;
          const priceArs = precioArs * d.quantity;
          const priceUsd = precioUsd * d.quantity;
          return (
            <div key={`${d.concept}-${d.detail ?? ''}-${d.currency}-${i}`} className={s['lineItem']}>
              <span>
                {d.concept === 'OTHER' ? d.detail || t('OTHER') : t(d.concept)}
                {d.material ? ` - ${d.material}` : ''}
                {d.m2 > 0 ? ` (${d.m2} m²)` : ''}
                {d.length && d.length > 0 && d.concept === 'OTHER' ? ` (${d.length} m)` : ''}
                {d.quantity > 1 ? ` x${d.quantity}` : ''}
              </span>
              <span className={s['lineItem__value']}>
                <span className={s['budget-panel__dual']}>
                  <span className={s['budget-panel__dual-ars']}>
                    {formatCurrency(priceArs)}
                  </span>
                  <span className={s['budget-panel__dual-usd']}>
                    <CurrencyDisplay value={priceUsd} currency="USD" />
                  </span>
                </span>
              </span>
            </div>
          );
        })}
      {materials.map((m, i) => {
        const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
        const subArs =
          m.currency === 'ARS' ? m2 * (m.price_m2 || 0)
            : dd > 0 ? m2 * (m.price_m2_usd || 0) * dd : 0;
        const subUsd =
          m.currency === 'USD' ? m2 * (m.price_m2_usd || 0)
            : dd > 0 ? (m2 * (m.price_m2 || 0)) / dd : 0;
        if (subArs <= 0 && subUsd <= 0) return null;
        return (
          <div key={m.id ?? `m-${m.name ?? 'unnamed'}-${i}`} className={s['lineItem']}>
            <span>
              {m.name} ({m2.toFixed(3)} m²)
              {m.quantity > 1 ? ` x${m.quantity}` : ''}
            </span>
            <span className={s['lineItem__value']}>
              <span className={s['budget-panel__dual']}>
                <span className={s['budget-panel__dual-ars']}>
                  {formatCurrency(subArs)}
                </span>
                <span className={s['budget-panel__dual-usd']}>
                  <CurrencyDisplay value={subUsd} currency="USD" />
                </span>
              </span>
            </span>
          </div>
        );
      })}
      {pools.map((pt, i) => {
        const precioArs =
          (pt.currency || 'ARS') === 'ARS' ? pt.price || 0
            : dd > 0 ? (pt.price || 0) * dd : 0;
        const precioUsd =
          (pt.currency || 'ARS') === 'USD' ? pt.price || 0
            : dd > 0 ? (pt.price || 0) / dd : 0;
        const arsTotal = precioArs * (pt.quantity || 1);
        const usdTotal = precioUsd * (pt.quantity || 1);
        return (
          <div key={pt.pool_id ?? `p-${pt.brand ?? 'unnamed'}-${pt.model ?? 'unnamed'}-${i}`} className={s['lineItem']}>
            <span>
              Pileta {pt.brand} - {pt.model}
              {pt.quantity > 1 ? ` (x${pt.quantity})` : ''}
            </span>
            <span className={s['lineItem__value']}>
              <span className={s['budget-panel__dual']}>
                <span className={s['budget-panel__dual-ars']}>
                  {formatCurrency(arsTotal)}
                </span>
                <span className={s['budget-panel__dual-usd']}>
                  <CurrencyDisplay value={usdTotal} currency="USD" />
                </span>
              </span>
            </span>
          </div>
        );
      })}
      {additionalWorks.map((a, i) => {
        // Mirror `useBudgetCalculations.additionalContribution` so the
        // list and the totals agree: `frente` rows carry a frozen `total`
        // (set by the picker at save time), `flat` rows fall back to
        // `price * quantity` when `total` is missing. Each row has a
        // single native currency (set by the picker); we display the
        // canonical amount in that currency and convert to the other
        // using `form.usd_rate`, matching the materials/pools block.
        const nativeTotal =
          a.type === 'frente'
            ? Number(a.total ?? 0)
            : Number(a.total ?? Number(a.price ?? 0) * Number(a.quantity ?? 1));
        if (!Number.isFinite(nativeTotal) || nativeTotal <= 0) return null;
        const currency = a.currency === 'USD' ? 'USD' : 'ARS';
        const arsTotal = currency === 'ARS' ? nativeTotal : (dd > 0 ? nativeTotal * dd : 0);
        const usdTotal = currency === 'USD' ? nativeTotal : (dd > 0 ? nativeTotal / dd : 0);
        const linearLabel =
          a.type === 'frente' && a.linear_meters && a.linear_meters > 0
            ? ` (${a.linear_meters} ml)`
            : '';
        const qtyLabel = a.type !== 'frente' && a.quantity > 1 ? ` x${a.quantity}` : '';
        const detalle = a.detail ? ` - ${a.detail}` : '';
        const frenteTag = a.type === 'frente' ? ' [Frente]' : '';
        return (
          <div key={`aw-${a.additional_work_id ?? 'aw'}-${i}`} className={s['lineItem']}>
            <span>
              {a.name}
              {detalle}
              {linearLabel}
              {qtyLabel}
              {frenteTag}
            </span>
            <span className={s['lineItem__value']}>
              <span className={s['budget-panel__dual']}>
                <span className={s['budget-panel__dual-ars']}>
                  {formatCurrency(arsTotal)}
                </span>
                <span className={s['budget-panel__dual-usd']}>
                  <CurrencyDisplay value={usdTotal} currency="USD" />
                </span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
