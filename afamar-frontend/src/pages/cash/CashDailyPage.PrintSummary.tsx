/**
 * `CashDailyPage` — print-only report footer blocks.
 *
 *  - the compact totals row (planilla style, one A4 page),
 *  - the signature block at the foot of the report,
 *  - the "generated on" footer line.
 */
import { formatCurrency } from '../../utils/formatters';
import styles from './CashDailyPage.module.css';

const s = styles as unknown as Record<string, string>;

export interface CashPrintSummaryProps {
  previousBalance: number;
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  realCash: number;
}

export function CashPrintSummary({
  previousBalance,
  totalIncome,
  totalExpenses,
  currentBalance,
  realCash,
}: CashPrintSummaryProps) {
  return (
    <>
      {/* Compact print-only totals block (planilla style, one A4 page) */}
      <div className={s['cash__print-totals']}>
        <div className={s['cash__print-totals-row']}>
          <div className={s['cash__print-totals-cell']}>
            <span className={s['cash__print-totals-label']}>Saldo Anterior</span>
            <span className={s['cash__print-totals-value']}>{formatCurrency(previousBalance)}</span>
          </div>
          <div className={s['cash__print-totals-cell']}>
            <span className={s['cash__print-totals-label']}>Entradas</span>
            <span className={s['cash__print-totals-value']}>{formatCurrency(totalIncome)}</span>
          </div>
          <div className={s['cash__print-totals-cell']}>
            <span className={s['cash__print-totals-label']}>Salidas</span>
            <span className={s['cash__print-totals-value']}>{formatCurrency(totalExpenses)}</span>
          </div>
          <div className={s['cash__print-totals-cell']}>
            <span className={s['cash__print-totals-label']}>Saldo Actual</span>
            <span className={s['cash__print-totals-value']}>{formatCurrency(currentBalance)}</span>
          </div>
          <div className={`${s['cash__print-totals-cell']} ${s['cash__print-totals-cell--highlight']}`}>
            <span className={s['cash__print-totals-label']}>Efectivo Real en Cajón</span>
            <span className={s['cash__print-totals-value']}>{formatCurrency(realCash)}</span>
          </div>
        </div>
      </div>

      {/* Print-only signature block at the foot of the report */}
      <div className={s['cash__print-signatures']}>
        <div className={s['cash__print-signature-item']}>
          <div className={s['cash__print-signature-line']} />
          <span className={s['cash__print-signature-label']}>Firma y Aclaración Responsable de Caja</span>
        </div>
        <div className={s['cash__print-signature-item']}>
          <div className={s['cash__print-signature-line']} />
          <span className={s['cash__print-signature-label']}>Firma y Aclaración Receptor / Administración</span>
        </div>
      </div>

      <div className={`print-only ${s['cash__print-footer-block']}`}>
        <span className={s['cash__print-footer']}>Reporte generado el {new Date().toLocaleDateString('es-AR')} a las {new Date().toLocaleTimeString('es-AR')}</span>
      </div>
    </>
  );
}
