import React from 'react';
import { formatCurrencyValue } from '../../../utils/formatters';
import styles from './QuoteOptionsGrid.module.css';

const s = styles as unknown as Record<string, string>;

interface Alternativa {
  name: string;
  category: string;
  currency: string;
  costoMaterialBase: number;
  totalFinalARS: number;
  length: number;
  width: number;
  quantity: number;
}

interface TrabajoComun {
  concept: string;
  quantity?: number;
  total: number;
  /** Native currency of this line. Defaults to ARS when omitted (backward-compat). */
  currency?: 'ARS' | 'USD';
}

interface Props {
  /** Selected (non-alternative) materials — rendered as the first column(s) with a "PRINCIPAL" badge. */
  mainMaterials?: Alternativa[];
  alternativas?: Alternativa[];
  /** Principal material rows shown right after "Costo Material base" in every card. */
  principalesBreakdown?: TrabajoComun[];
  detalleTrabajosComunes?: TrabajoComun[];
  tipoCambio?: number;
  budgetId?: number | string;
  onConvertirAlternativa?: (idx: number) => void;
  modoUSD?: boolean;
}

// JSX-side helper because lucide icons & HTML entities are not used here.
const QuoteOptionsGrid = ({
  mainMaterials,
  alternativas,
  principalesBreakdown,
  detalleTrabajosComunes,
  tipoCambio = 1000,
  budgetId,
  onConvertirAlternativa,
  modoUSD = false,
}: Props) => {
  const listaPrincipales: Alternativa[] = mainMaterials && mainMaterials.length > 0 ? mainMaterials : [];
  const listaAlternativas: Alternativa[] = alternativas && alternativas.length > 0 ? alternativas : [
    { name: 'GRIS MARA', category: 'GRANITOS', currency: 'ARS', costoMaterialBase: 180000, totalFinalARS: 390000, length: 2.1, width: 2, quantity: 1 },
    { name: 'TAJ MAHAL', category: 'SINTERIZADOS', currency: 'USD', costoMaterialBase: 350, totalFinalARS: 560000, length: 2.1, width: 2, quantity: 1 }
  ];

  const listaTrabajos: TrabajoComun[] = detalleTrabajosComunes ?? [];

  const t_cambio = tipoCambio || 1000;

  const formatMonto = (n: number, enUSD: boolean): string => {
    if (modoUSD && t_cambio > 0) return formatCurrencyValue(n / t_cambio, { currency: 'USD', locale: 'en-US' });
    if (enUSD) return formatCurrencyValue(n, { currency: 'USD', locale: 'en-US' });
    return formatCurrencyValue(n, { currency: 'ARS' });
  };

  const renderCard = (mat: Alternativa, idx: number, isMain: boolean) => {
    const esTarjetaUSD = mat.currency === 'USD';
    const stripeClass = isMain
      ? `${s['quote-options__card-stripe']} ${s['quote-options__card-stripe--main']}`
      : `${s['quote-options__card-stripe']} ${esTarjetaUSD ? s['quote-options__card-stripe--usd'] : s['quote-options__card-stripe--ars']}`;
    const badgeClass = isMain
      ? `${s['quote-options__badge']} ${s['quote-options__badge--main']}`
      : `${s['quote-options__badge']}${esTarjetaUSD ? ' ' + s['quote-options__badge--usd'] : ''}`;
    const badgeLabel = isMain ? 'PRINCIPAL' : `Alternativa ${String.fromCharCode(65 + idx)}`;
    const cardClass = isMain
      ? `${s['quote-options__card']} ${s['quote-options__card--main']}`
      : s['quote-options__card'];

    return (
      <div key={isMain ? `main-${idx}` : `alt-${idx}`} className={cardClass}>
        <div className={stripeClass} />

        <div>
          <div className={s['quote-options__card-head']}>
            <span className={badgeClass}>{badgeLabel}</span>
            <span className={s['quote-options__qty']}>
              {mat.quantity || 1} pza. ({Number(mat.length * mat.width || 1.216).toFixed(2)} m²)
            </span>
          </div>

          <h4 className={s['quote-options__name']}>{mat.name}</h4>
          <div className={s['quote-options__category']}>{mat.category}</div>

          <div className={s['quote-options__detail-box']}>
            <div className={s['quote-options__detail-header']}>
              <span>Concepto</span>
              <span>Subtotal</span>
            </div>

            <div className={s['quote-options__detail-row']}>
              <span className={s['quote-options__detail-label']}>Costo Material base:</span>
              <span>
                <span className={s['quote-options__detail-value']}>{formatMonto(mat.costoMaterialBase, esTarjetaUSD)}</span>
                {t_cambio > 0 && (
                  <span className={s['quote-options__detail-value-usd']}>
                    {esTarjetaUSD
                      ? `≈ ${formatCurrencyValue(Math.round(mat.costoMaterialBase * t_cambio), { currency: 'ARS', decimals: 0 })}`
                      : `≈ ${formatCurrencyValue(mat.costoMaterialBase / t_cambio, { currency: 'USD', locale: 'en-US' })}`}
                  </span>
                )}
              </span>
            </div>

            {(principalesBreakdown ?? []).map((job: TrabajoComun, i: number) => {
              const jobCurrency = job.currency || 'ARS';
              const jobEsUSD = jobCurrency === 'USD';
              return (
                <div
                  key={`main-${i}`}
                  className={`${s['quote-options__detail-row']} ${s['quote-options__detail-row--dashed']}`}
                >
                  <span className={s['quote-options__detail-label--muted']}>
                    {job.concept} ({job.quantity && job.quantity > 1 ? `x${job.quantity}` : 'x1'})
                  </span>
                  <span>
                    <span className={s['quote-options__detail-value--muted']}>
                      {jobEsUSD
                        ? formatCurrencyValue(job.total, { currency: 'USD', locale: 'en-US' })
                        : formatCurrencyValue(job.total, { currency: 'ARS' })}
                    </span>
                    {t_cambio > 0 && (
                      <span className={s['quote-options__detail-value-usd']}>
                        {jobEsUSD
                          ? `≈ ${formatCurrencyValue(Math.round(job.total * t_cambio), { currency: 'ARS', decimals: 0 })}`
                          : `≈ ${formatCurrencyValue(job.total / t_cambio, { currency: 'USD', locale: 'en-US' })}`}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}

            {listaTrabajos.map((job: TrabajoComun, i: number) => {
              const jobCurrency = job.currency || 'ARS';
              const jobEsUSD = jobCurrency === 'USD';
              return (
                <div
                  key={i}
                  className={`${s['quote-options__detail-row']} ${s['quote-options__detail-row--dashed']}`}
                >
                  <span className={s['quote-options__detail-label--muted']}>
                    {job.concept.replace('CUTOUT_SINK - ', '')}
                  </span>
                  <span>
                    <span className={s['quote-options__detail-value--muted']}>
                      {jobEsUSD
                        ? formatCurrencyValue(job.total, { currency: 'USD', locale: 'en-US' })
                        : formatCurrencyValue(job.total, { currency: 'ARS' })}
                    </span>
                    {t_cambio > 0 && (
                      <span className={s['quote-options__detail-value-usd']}>
                        {jobEsUSD
                          ? `≈ ${formatCurrencyValue(Math.round(job.total * t_cambio), { currency: 'ARS', decimals: 0 })}`
                          : `≈ ${formatCurrencyValue(job.total / t_cambio, { currency: 'USD', locale: 'en-US' })}`}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={s['quote-options__total-wrap']}>
          <div className={s['quote-options__total']}>
            <span className={s['quote-options__total-label']}>TOTAL PRESUPUESTO</span>
            <span className={s['quote-options__total-value']}>
              {modoUSD && t_cambio > 0
                ? formatCurrencyValue(mat.totalFinalARS / t_cambio, { currency: 'USD', locale: 'en-US' })
                : formatCurrencyValue(Math.round(mat.totalFinalARS), { currency: 'ARS', decimals: 0 })}
            </span>
            {t_cambio > 0 && (
              <span className={s['quote-options__total-usd']}>
                {modoUSD
                  ? `≈ ${formatCurrencyValue(Math.round(mat.totalFinalARS), { currency: 'ARS', decimals: 0 })}`
                  : `≈ ${formatCurrencyValue(mat.totalFinalARS / t_cambio, { currency: 'USD', locale: 'en-US' })}`}
              </span>
            )}
          </div>
        </div>

        {!isMain && budgetId && onConvertirAlternativa && (
          <button
            type="button"
            className={s['quote-options__convert']}
            onClick={() => onConvertirAlternativa(idx)}
          >
            <span className={s['quote-options__convert-icon']}>+</span>
            Convertir Alternativa en OT
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={s['quote-options']}>
      <h3 className={s['quote-options__title']}>Opciones de Cotización Disponibles</h3>

      <div className={s['quote-options__grid']}>
        {listaAlternativas.map((mat, idx) => renderCard(mat, idx, false))}
      </div>
    </div>
  );
};

export default QuoteOptionsGrid;
export type { Alternativa, TrabajoComun };