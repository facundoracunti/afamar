import React from 'react';
import { formatCurrencyValue } from '../../utils/formatters';
import type { EntityFormState } from '../../types/form';
import type { MaterialInForm, PoolInForm } from '../../types/budget';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface AlternativeBudgetGridProps {
  form: EntityFormState;
  matsAlt: MaterialInForm[];
  modoUSD: boolean;
}

export function AlternativeBudgetGrid({ form, matsAlt, modoUSD }: AlternativeBudgetGridProps) {
  const dd2 = Number(form.usd_rate);
  const mostrarUSDAlt = modoUSD && dd2 > 0;

  const fabricationDetails = form.fabrication_details || [];
  const poolsData = (form.pools_data || []) as unknown as PoolInForm[];

  const fijosArsAlt = fabricationDetails.reduce((s: number, d) => s + (Number(d.price) || 0) * (d.quantity || 1), 0)
    + poolsData.reduce((s: number, pt) => s + (Number(pt.price) || 0) * (Number(pt.quantity) || 1), 0)
    + (Number(form.transport) || 0);

  return (
    <div className={s['work-order-form__alt-grid']}>
      <div className={s['work-order-form__alt-header']}>
        <span className={s['work-order-form__alt-header-title']}>📋 PRESUPUESTO COMPARATIVO</span>
        <span className={s['work-order-form__alt-header-count']}>{matsAlt.length} opciones alternativas</span>
      </div>
      <div className={s['work-order-form__alt-cards']}>
        {matsAlt.map((mat: MaterialInForm, idx: number) => {
          const letra = String.fromCharCode(65 + idx);
          const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
          const costoMat = mat.currency === 'USD' ? m2 * (mat.price_m2_usd || 0) : m2 * (mat.price_m2 || 0);
          const costoMatArs = mat.currency === 'USD' ? (dd2 > 0 ? costoMat * dd2 : 0) : costoMat;
          const totalArs = costoMatArs + fijosArsAlt;

          return (
            <div key={idx} className={s['work-order-form__alt-card']}>
              <div>
                <div className={s['work-order-form__alt-card-head']}>
                  <span className={s['work-order-form__alt-card-badge']}>Alternativa {letra}</span>
                  <span className={s['work-order-form__alt-card-pza']}>{mat.quantity || 1} pza. ({m2.toFixed(3)} m²)</span>
                </div>
                <div className={s['work-order-form__alt-card-name']}>{mat.name}</div>
                {mat.currency === 'USD' && <div className={s['work-order-form__alt-card-usd']}>USD {costoMat.toFixed(2)}</div>}
                <div className={s['work-order-form__alt-card-body']}>
                  <div className={s['work-order-form__alt-card-row']}>
                    <span>Material:</span>
                    <span className={s['work-order-form__alt-card-value']}>
                      {mostrarUSDAlt
                        ? formatCurrencyValue(costoMatArs / dd2, { currency: 'USD' })
                        : formatCurrencyValue(costoMatArs)}
                    </span>
                  </div>
                  <div className={s['work-order-form__alt-card-row']}>
                    <span>Trabajos + Piletas + Traslado:</span>
                    <span className={s['work-order-form__alt-card-value']}>
                      {mostrarUSDAlt
                        ? formatCurrencyValue(fijosArsAlt / dd2, { currency: 'USD' })
                        : formatCurrencyValue(fijosArsAlt)}
                    </span>
                  </div>
                </div>
              </div>
              <div className={s['work-order-form__alt-card-total']}>
                <div className={s['work-order-form__alt-card-total-lbl']}>
                  Total alternativa {mostrarUSDAlt ? '(USD)' : ''}
                </div>
                <div className={s['work-order-form__alt-card-total-val']}>
                  {mostrarUSDAlt
                    ? formatCurrencyValue(totalArs / dd2, { currency: 'USD' })
                    : formatCurrencyValue(Math.round(totalArs), { decimals: 0 })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={s['work-order-form__alt-footer']}>
        * Todos los totales incluyen la misma configuración de trabajos, pools y traslados.
      </div>
    </div>
  );
}
