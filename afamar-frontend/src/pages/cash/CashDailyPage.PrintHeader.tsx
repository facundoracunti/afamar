/**
 * `CashDailyPage` — print-only report header.
 *
 * Rendered only when printing (`print-only`): the "CIERRE DE CAJA" title,
 * the box number and the opening / closing timestamps.
 */
import { formatDateTime } from './CashDailyPage.format';
import styles from './CashDailyPage.module.css';

const s = styles as unknown as Record<string, string>;

export interface CashPrintHeaderProps {
  boxNumber?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
}

export function CashPrintHeader({ boxNumber, openedAt, closedAt }: CashPrintHeaderProps) {
  return (
    <div className={`print-only ${s['cash__print-header']}`}>
      <h1 className={s['cash__print-title']}>CIERRE DE CAJA</h1>
      {boxNumber !== undefined && boxNumber !== null && (
        <p className={s['cash__print-date']}>Caja #{boxNumber}</p>
      )}
      <p className={s['cash__print-date']}>
        Apertura: {formatDateTime(openedAt)}
        {closedAt ? ` — Cierre: ${formatDateTime(closedAt)}` : ''}
      </p>
      <hr className={s['cash__print-hr']} />
    </div>
  );
}
