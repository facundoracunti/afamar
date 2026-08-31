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
  /** Total m² for the option (length × width × quantity). */
  totalM2?: number;
  /** Per-option ARS subtotal (from the PDF section builder). When present
   *  every total cell uses it — the number the PDF draws for this option. */
  subtotalARS?: number;
  /** Per-option USD subtotal. */
  subtotalUSD?: number;
  /** Per-option detail lines. When present, rendered instead of the shared
   *  common jobs (each alternative shows its own revalued rows). */
  detail?: AlternativaDetailRow[];
}

interface AlternativaDetailRow {
  concept: string;
  quantity?: number;
  total: number;
  currency: 'ARS' | 'USD';
  materialName?: string | null;
}

interface TrabajoComun {
  concept: string;
  quantity?: number;
  total: number;
  /** Native currency of this line. Defaults to ARS when omitted (backward-compat). */
  currency?: 'ARS' | 'USD';
  /** Link al material al que pertenece este row:
   *   - null/undefined → trabajo común (aparece en main + TODAS las alts)
   *   - '__GLOBAL__'  → global (aparece en main + TODAS las alts)
   *   - '<name>'      → atado a ese material (solo aparece en su card) */
  materialName?: string | null;
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

    // Per-option totals. When the card carries a PDF-derived subtotal
    // (`subtotalARS`/`subtotalUSD`) every total cell uses it so the card
    // mirrors the "Subtotal Opción" the PDF draws. Otherwise it falls back
    // to the legacy single-number behaviour.
    const hasSubtotal = mat.subtotalARS != null && mat.subtotalUSD != null;
    const arsTotal = hasSubtotal ? mat.subtotalARS! : Math.round(mat.totalFinalARS);
    const usdTotal = hasSubtotal
      ? mat.subtotalUSD!
      : (t_cambio > 0 ? Math.round(mat.totalFinalARS / t_cambio * 100) / 100 : 0);

    return (
      <div key={isMain ? `main-${idx}` : `alt-${idx}`} className={cardClass}>
        <div className={stripeClass} />

        <div>
          <div className={s['quote-options__card-head']}>
            <span className={badgeClass}>{badgeLabel}</span>
            <span className={s['quote-options__qty']}>
              {mat.quantity || 1} pza. ({Number(mat.totalM2 ?? (mat.length * mat.width || 1.216)).toFixed(2)} m²)
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
                <span className={`${s['quote-options__detail-value']} ${esTarjetaUSD ? s['quote-options__detail-value--usd'] : ''}`}>
                  {formatMonto(mat.costoMaterialBase, esTarjetaUSD)}
                </span>
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
                    <span className={`${s['quote-options__detail-value--muted']} ${jobEsUSD ? s['quote-options__detail-value--usd'] : ''}`}>
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

            {(mat.detail && mat.detail.length > 0
              ? mat.detail.map((job: AlternativaDetailRow, i: number) => ({
                  concept: job.concept,
                  quantity: job.quantity,
                  total: job.total,
                  currency: job.currency,
                  materialName: job.materialName,
                  key: `${job.concept}-${job.total}-${job.currency}-${i}`,
                }))
              : listaTrabajos
                  .filter((job) => {
                    const mn = job.materialName;
                    // Trabajo común o global: aparece en TODAS las cards
                    if (!mn || mn === '__GLOBAL__') return true;
                    // Atado a un material: solo aparece en SU card (main o alt)
                    return mn === mat.name;
                  })
                  .map((job: TrabajoComun, i: number) => ({
                    concept: job.concept,
                    quantity: job.quantity,
                    total: job.total,
                    currency: job.currency || 'ARS',
                    materialName: job.materialName,
                    key: `${job.concept}-${job.total}-${job.currency ?? 'ARS'}-${i}`,
                  }))
            ).map((job) => {
              const jobEsUSD = job.currency === 'USD';
              return (
                <div
                  key={job.key}
                  className={`${s['quote-options__detail-row']} ${s['quote-options__detail-row--dashed']}`}
                >
                  <span className={s['quote-options__detail-label--muted']}>
                    {job.concept.replace('CUTOUT_SINK - ', '')}
                  </span>
                  <span>
                    <span className={`${s['quote-options__detail-value--muted']} ${jobEsUSD ? s['quote-options__detail-value--usd'] : ''}`}>
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

        <div className={s['quote-options__totals-block']}>
          {/* Subtotales + TOTAL — fila con 4 cards (ARS, USD) */}
          <div className={s['quote-options__totals-row']}>
            <div className={s['quote-options__totals-cell']}>
              <div className={s['quote-options__totals-label']}>SUBTOTALES (ARS)</div>
              <div className={s['quote-options__totals-value']}>
                {formatCurrencyValue(arsTotal, { currency: 'ARS', decimals: 0 })}
              </div>
            </div>
            <div className={s['quote-options__totals-cell']}>
              <div className={s['quote-options__totals-label']}>TOTAL ARS</div>
              <div className={s['quote-options__totals-value']}>
                {formatCurrencyValue(arsTotal, { currency: 'ARS', decimals: 0 })}
              </div>
            </div>
            <div className={s['quote-options__totals-cell']}>
              <div className={s['quote-options__totals-label']}>SUBTOTALES (USD)</div>
              <div className={`${s['quote-options__totals-value']} ${s['quote-options__totals-value--usd']}`}>
                {t_cambio > 0
                  ? formatCurrencyValue(usdTotal, { currency: 'USD' })
                  : '—'}
              </div>
            </div>
            <div className={s['quote-options__totals-cell']}>
              <div className={s['quote-options__totals-label']}>TOTAL USD</div>
              <div className={`${s['quote-options__totals-value']} ${s['quote-options__totals-value--usd']}`}>
                {t_cambio > 0
                  ? formatCurrencyValue(usdTotal, { currency: 'USD' })
                  : '—'}
              </div>
            </div>
          </div>
          {/* Saldo pendiente — fila con 2 cards (ARS, USD) que abarcan 2 columnas cada una */}
          <div className={`${s['quote-options__totals-row']} ${s['quote-options__totals-row--saldo']}`}>
            <div className={s['quote-options__totals-cell']}>
              <div className={s['quote-options__totals-label']}>SALDO PENDIENTE ARS</div>
              <div className={s['quote-options__totals-value']}>
                {formatCurrencyValue(arsTotal, { currency: 'ARS', decimals: 0 })}
              </div>
            </div>
            <div className={s['quote-options__totals-cell']}>
              <div className={s['quote-options__totals-label']}>SALDO PENDIENTE USD</div>
              <div className={`${s['quote-options__totals-value']} ${s['quote-options__totals-value--usd']}`}>
                {t_cambio > 0
                  ? formatCurrencyValue(usdTotal, { currency: 'USD' })
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={s['quote-options']}>
      <div className={s['quote-options__grid']}>
        {/* Principal primero (mismo componente que las alternativas) */}
        {listaPrincipales.map((mat, idx) => renderCard(mat, idx, true))}
        {listaAlternativas.map((mat, idx) => renderCard(mat, idx, false))}
      </div>
    </div>
  );
};

export default QuoteOptionsGrid;
export type { Alternativa, TrabajoComun };