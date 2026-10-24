/**
 * `CashDailyPage` — the two movement tables (Entradas / Salidas).
 *
 * The column definitions live here (they need the live work-order catalog
 * to resolve the CURRENT saldo and estado of each movement).
 */
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import type { CashMovement } from '../../types/cash';
import {
  resolveBalanceDue,
  resolveStatus,
  FALLBACK_OT_STATUS,
  type WorkOrdersById,
} from '../../utils/cashMovementFormatters';
import { folderStatusClass } from '../../constants';
import { t } from '../../utils/translate';
import { formatCurrency } from '../../utils/formatters';
import { CashMovementTable } from '../../components/cash/CashMovementTable/CashMovementTable';
import styles from './CashDailyPage.module.css';

const s = styles as unknown as Record<string, string>;

export interface CashMovementsProps {
  incomes: CashMovement[];
  expenses: CashMovement[];
  workOrdersById: WorkOrdersById;
  isClosed: boolean;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onDelete: (id: number) => void;
}

export function CashMovements({
  incomes,
  expenses,
  workOrdersById,
  isClosed,
  onAddIncome,
  onAddExpense,
  onDelete,
}: CashMovementsProps) {
  return (
    <div className={s['cash__movements-grid']}>
      <CashMovementTable
        title="Entradas (Ingresos)"
        titleColor="#16a34a"
        icon={<ArrowUpCircle size={20} />}
        addLabel="Agregar Ingreso"
        emptyMessage="Sin ingresos registrados"
        movements={incomes}
        columns={[
          { key: 'order_number', label: 'N° Orden', width: 90, render: (m) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.order_number || '-'}</span> },
          { key: 'client_name', label: 'Cliente', render: (m) => m.client_name || '-' },
          { key: 'amount', label: 'Monto', width: 110, render: (m) => <span className={s['cash__amount--income']}>{formatCurrency(m.amount)}</span> },
          { key: 'remaining_balance', label: 'Saldo Restante', width: 130, render: (m) => {
            // Resolver contra el `balance_due` ACTUAL de la OT
            // (catálogo vivo) → cae al snapshot del movimiento →
            // heurística `order_total - amount`. Siempre
            // formato moneda ($ 0,00 incluido) cuando hay OT
            // asociada; `'-'` solo cuando el movimiento no
            // tiene `order_id` (egreso genérico / ingreso libre).
            const orderId = m.order_id;
            if (orderId == null) return '-';
            // El helper garantiza `number` cuando `order_id`
            // está presente; el `?? 0` es solo para contentar
            // el type-narrowing de TS (no debería disparar).
            const v = resolveBalanceDue(m, workOrdersById) ?? 0;
            return (
              <span
                className={v > 0 ? s['cash__amount--expense'] : s['cash__balance--positive']}
                title={v === 0 ? 'Saldo completamente cobrado' : 'Saldo pendiente'}
              >
                {formatCurrency(v)}
              </span>
            );
          }
          },
          { key: 'payment_method', label: 'Pago', width: 140, render: (m) => {
            const pm = m.payment_method as string;
            return <span className="badge badge-pending">{pm || '-'}</span>;
          }
          },
          { key: 'folder_status', label: 'Estado', width: 110, render: (m) => {
            // Prioridad: `status` ACTUAL de la OT → snapshot del
            // movimiento. Para movimientos SIN OT asociada
            // muestra `'-'`. Para los que sí tienen OT,
            // siempre muestra un badge (incluso si el status
            // no llegó, usa `MEASUREMENT` como fallback).
            const fs = resolveStatus(m, workOrdersById) ?? (m.order_id != null ? FALLBACK_OT_STATUS : null);
            return fs ? <span className={`badge ${folderStatusClass(fs)}`}>{t(fs)}</span> : '-';
          }
          },
        ]}
        closed={isClosed}
        onAdd={onAddIncome}
        onDelete={onDelete}
      />
      <CashMovementTable
        title="Salidas (Egresos)"
        titleColor="#dc2626"
        icon={<ArrowDownCircle size={20} />}
        addLabel="Agregar Egreso"
        emptyMessage="Sin egresos registrados"
        movements={expenses}
        columns={[
          { key: 'description', label: 'Concepto', render: (m) => m.description || '-' },
          { key: 'amount', label: 'Monto', width: 110, render: (m) => <span className={s['cash__amount--expense']}>{formatCurrency(m.amount)}</span> },
          { key: 'expense_type', label: 'Tipo', width: 90, render: (m) => {
            const et = m.expense_type as string;
            const cls = et === 'GENERAL' ? 'badge-rejected' : 'badge-production';
            return <span className={`badge ${cls}`}>{et || 'GENERAL'}</span>;
          }
          },
        ]}
        closed={isClosed}
        onAdd={onAddExpense}
        onDelete={onDelete}
      />
    </div>
  );
}
