import React from 'react';
import styles from './MeasurementAdjustmentDialog.module.css';

export interface MeasurementAdjustmentProposal {
  measurement_fingerprint: string;
  original_total: number;
  original_total_usd: number;
  positive_difference_ars: number;
  negative_difference_ars: number;
  difference_ars: number;
  difference_usd: number;
  discount_difference_ars: number;
  discount_percentage: number;
  discount_fixed_amount: number;
  new_total: number;
  new_total_usd: number;
  payments_ars: number;
  payments_usd: number;
  new_balance_due: number;
  new_balance_due_usd: number;
  usd_rate: number;
  gross_difference_ars?: number;
  gross_difference_usd?: number;
  commercial_discount_ars?: number;
  catalogue_adjustment_ars?: number;
  commercial_adjustment_delta_ars?: number;
  reconciliation_error_ars?: number;
  approval_blocked?: boolean;
  blocking_reasons?: string[];
  comparison?: Array<{
    name: string;
    is_detail?: boolean;
    measure_budgeted_str?: string | null;
    measure_real_str?: string | null;
    measure_delta_str?: string | null;
    subtotal_ars_str?: string | null;
    subtotal_usd_str?: string | null;
  }>;
}

interface Props {
  proposal: MeasurementAdjustmentProposal | null;
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const money = (value: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value || 0);

export default function MeasurementAdjustmentDialog({ proposal, open, saving, onCancel, onConfirm }: Props) {
  if (!open || !proposal) return null;
  const detailRows = [
    ['Diferencias positivas', money(proposal.positive_difference_ars)],
    ['Diferencias negativas', money(proposal.negative_difference_ars)],
    ['Descuento comercial', money(proposal.commercial_discount_ars ?? 0)],
    ['Ajuste de método de pago', money(proposal.catalogue_adjustment_ars ?? 0)],
    ['Variación de ajustes comerciales', money(proposal.commercial_adjustment_delta_ars ?? 0)],
    ['Cotización utilizada', `1 USD = ${money(proposal.usd_rate)}`],
    ['Pagos registrados', `${money(proposal.payments_ars)} / ${money(proposal.payments_usd, 'USD')}`],
  ];
  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="measurement-adjustment-title">
        <h2 id="measurement-adjustment-title">Confirmar diferencias de medición</h2>
        <p className={styles.warning}>Los importes se calcularon con la cotización congelada de la orden.</p>
        {proposal.approval_blocked && (
          <div className={styles.blocked} role="alert">
            <strong>No se puede confirmar todavía.</strong>
            {proposal.reconciliation_error_ars != null && (
              <p>La diferencia bruta y la diferencia comercial no coinciden por {money(Math.abs(proposal.reconciliation_error_ars))}.</p>
            )}
            <ul>
              {(proposal.blocking_reasons || ['La propuesta necesita revisión.']).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        <dl className={styles.summary}>
          <dt>Importe original acordado</dt><dd>{money(proposal.original_total)}</dd>
          <dt>Diferencia económica por medición</dt><dd>{money(proposal.difference_ars)} / {money(proposal.difference_usd, 'USD')}</dd>
          <dt>Nuevo total comercial propuesto</dt><dd>{money(proposal.new_total)} / {money(proposal.new_total_usd, 'USD')}</dd>
          <dt>Saldo pendiente</dt><dd>{money(proposal.new_balance_due)} / {money(proposal.new_balance_due_usd, 'USD')}</dd>
        </dl>
        <details className={styles.details}>
          <summary>Ver detalle de diferencias</summary>
          {proposal.comparison && proposal.comparison.length > 0 ? (
            <div className={styles.breakdown}>
              {proposal.comparison.map((row, index) => (
                <div className={styles.breakdownRow} key={`${row.name}-${index}`}>
                  <strong>{row.name}</strong>
                  <span>{row.measure_budgeted_str ?? '—'} → {row.measure_real_str ?? '—'} ({row.measure_delta_str ?? '—'})</span>
                  <b>{row.subtotal_ars_str ?? '—'} / {row.subtotal_usd_str ?? '—'}</b>
                </div>
              ))}
            </div>
          ) : null}
          <dl className={styles.detailSummary}>
            {detailRows.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}
          </dl>
        </details>
        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={saving || proposal.approval_blocked}>
            {saving ? 'CONFIRMANDO...' : 'Confirmar diferencias'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
