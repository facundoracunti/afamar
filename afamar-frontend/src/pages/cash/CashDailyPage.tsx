import React, { useState, useEffect, useMemo } from 'react';
import { Printer, Lock, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { getCurrentCash, createCashMovement, deleteCashMovement, setPreviousBalance, closeCash } from '@/api/resources/cash';
import type { CashMovePayload } from '@/api/resources/cash';
import type { CashRegister, CashMovement } from '../../types/cash';
import type { WorkOrderListItem } from '../../types/workOrder';
import { useGet } from '../../api/hooks';
import { formatCurrency } from '../../utils/formatters';
import {
  resolveBalanceDue,
  resolveStatus,
  FALLBACK_OT_STATUS,
  type WorkOrdersById,
} from '../../utils/cashMovementFormatters';
import { folderStatusClass } from '../../constants';
import { t } from '../../utils/translate';
import { parseApiError } from '../../utils/error';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import PreviousBalanceCard from '../../components/cash/PreviousBalanceCard/PreviousBalanceCard';
import { CashMovementTable } from '../../components/cash/CashMovementTable/CashMovementTable';
import CashTotalCards from '../../components/cash/CashTotalCards/CashTotalCards';
import IncomeModal from '../../components/cash/IncomeModal/IncomeModal';
import ExpenseModal from '../../components/cash/ExpenseModal/ExpenseModal';
import CloseCashModal from '../../components/cash/CloseCashModal/CloseCashModal';
import { getWorkOrders } from '@/api/resources/workOrders';
import { useNotify } from '../../context/NotificationContext';
import styles from './CashDailyPage.module.css';

const s = styles as unknown as Record<string, string>;

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function CashDailyPage() {
  const [previousBalance, setPreviousBalanceState] = useState<number>(0);
  const [previousBalanceEdit, setPreviousBalanceEdit] = useState<boolean>(false);

  const [showIncome, setShowIncome] = useState<boolean>(false);
  const [showExpense, setShowExpense] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [showClose, setShowClose] = useState<boolean>(false);

  const notify = useNotify();

  const { data: cashData, loading, load: loadCaja } = useGet<CashRegister | undefined>(
    ['cash', 'current'],
    async () => {
      const res = await getCurrentCash();
      return (res.data as CashRegister) || undefined;
    },
    true,
    5000,
    0,
  );

  // Catálogo vivo de OTs — el SALDO RESTANTE y el ESTADO del movimiento
  // se resuelven contra el `balance_due` / `status` ACTUAL de la OT, no
  // contra el snapshot al momento del cobro. Si la OT fue borrada o el
  // catálogo aún no cargó, caemos al snapshot embebido en el movimiento.
  const { data: workOrdersData } = useGet<WorkOrderListItem[] | undefined>(
    ['work-orders', 'list', 'for-cash'],
    async () => {
      const res = await getWorkOrders({ limit: 200 });
      return (res.data as unknown as WorkOrderListItem[]) || [];
    },
    true,
    60_000,
    0,
  );
  const workOrdersById = useMemo<WorkOrdersById>(() => {
    const map = new Map<number, WorkOrderListItem>();
    for (const wo of workOrdersData || []) {
      if (typeof wo.id === 'number') map.set(wo.id, wo);
    }
    return map;
  }, [workOrdersData]);

  const movements = (cashData?.movements as CashMovement[] | undefined) || [];
  const isClosed = !!cashData?.is_closed;
  const boxNumber = cashData?.number;
  const openedAt = cashData?.opened_at;
  const closedAt = cashData?.closed_at;

  const handleSavePreviousBalance = async () => {
    try {
      await setPreviousBalance(previousBalance);
      setPreviousBalanceEdit(false);
      loadCaja();
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al guardar saldo anterior'), 'error');
    }
  };

  const handleAddIncome = async (data: Record<string, unknown>) => {
    try {
      await createCashMovement(data as CashMovePayload);
      setShowIncome(false);
      await loadCaja();
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al registrar ingreso'), 'error');
    }
  };

  const handleAddExpense = async (data: Record<string, unknown>) => {
    try {
      await createCashMovement(data as CashMovePayload);
      setShowExpense(false);
      await loadCaja();
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al registrar egreso'), 'error');
    }
  };

  const handleDeleteMovement = async () => {
    if (!deleteId) return;
    try {
      await deleteCashMovement(deleteId);
      setDeleteId(null);
      await loadCaja();
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al eliminar movimiento'), 'error');
    }
  };

  const handleCloseCash = async (notes: string) => {
    try {
      const res = await closeCash(notes || undefined);
      const next = res.data?.next_cash;
      setShowClose(false);
      await loadCaja();
      notify(next?.number ? `Caja #${next.number} abierta` : 'Caja cerrada', 'success');
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al cerrar la caja'), 'error');
    }
  };

  const handlePrint = () => window.print();

  const incomes = movements.filter((m) => m.type === 'INCOME');
  const expenses = movements.filter((m) => m.type === 'EXPENSE');

  const currentBalance = cashData?.current_balance ?? 0;
  const realCash = cashData?.real_cash ?? 0;

  // Mantiene el input del saldo anterior en sync con el valor persistido de
  // la caja, PERO solo cuando NO estamos editando (si el operador está
  // tipeando, no pisan lo que escribe). Sin esto, el input controla por
  // `cashData?.previous_balance` (que no cambia hasta guardar) y lo que se
  // escribe no aparece.
  useEffect(() => {
    if (!previousBalanceEdit) {
      setPreviousBalanceState(cashData?.previous_balance ?? 0);
    }
  }, [cashData?.previous_balance, previousBalanceEdit]);

  return (
    <div className={s['cash']}>
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>
      <div id="print-area">
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

        {/* Header */}
        <div className={`no-print ${s['cash__page-header']}`}>
          <h1 className={s['cash__page-header-title']}>
            Caja {boxNumber !== undefined && boxNumber !== null ? `#${boxNumber}` : ''}
            {isClosed ? <span className={`badge badge-finished ${s['cash__badge']}`}>Cerrada</span>
              : <span className={`badge badge-approved ${s['cash__badge']}`}>Abierta</span>}
          </h1>
          <div className={s['cash__controls']}>
            {!isClosed && (
              <button className={`btn btn-danger ${s['cash__controls-btn']}`}
                onClick={() => setShowClose(true)}>
                <Lock size={14} className={s['cash__icon-inline']} /> Cerrar Caja
              </button>
            )}
            <button className={`btn btn-outline ${s['cash__controls-btn']}`}
              onClick={handlePrint}>
              <Printer size={14} className={s['cash__icon-inline']} /> Imprimir Reporte
            </button>
          </div>
        </div>

        <div className={`no-print ${s['cash__meta']}`}>
          <span>Apertura: <strong>{formatDateTime(openedAt)}</strong></span>
          {closedAt && <span>Cierre: <strong>{formatDateTime(closedAt)}</strong></span>}
        </div>

        <div className="no-print">
          <PreviousBalanceCard
            previousBalance={previousBalance}
            cerrada={isClosed}
            editMode={previousBalanceEdit}
            onEdit={() => setPreviousBalanceEdit(true)}
            onCancel={() => { setPreviousBalanceEdit(false); loadCaja(); }}
            onSave={handleSavePreviousBalance}
            onChange={(v: number) => setPreviousBalanceState(v)}
          />
        </div>

        {loading ? <LoadingSpinner /> : (
          <>
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
                onAdd={() => setShowIncome(true)}
                onDelete={(id: number) => setDeleteId(id)}
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
                onAdd={() => setShowExpense(true)}
                onDelete={(id: number) => setDeleteId(id)}
              />
            </div>

            <div className="no-print">
              <CashTotalCards
                suma={cashData?.total_sum ?? 0}
                totalSalidas={cashData?.total_expenses ?? 0}
                currentBalance={currentBalance}
                efectivoReal={realCash}
              />
            </div>
          </>
        )}

        {/* Compact print-only totals block (planilla style, one A4 page) */}
        <div className={s['cash__print-totals']}>
          <div className={s['cash__print-totals-row']}>
            <div className={s['cash__print-totals-cell']}>
              <span className={s['cash__print-totals-label']}>Saldo Anterior</span>
              <span className={s['cash__print-totals-value']}>{formatCurrency(cashData?.previous_balance ?? 0)}</span>
            </div>
            <div className={s['cash__print-totals-cell']}>
              <span className={s['cash__print-totals-label']}>Entradas</span>
              <span className={s['cash__print-totals-value']}>{formatCurrency(cashData?.total_income ?? 0)}</span>
            </div>
            <div className={s['cash__print-totals-cell']}>
              <span className={s['cash__print-totals-label']}>Salidas</span>
              <span className={s['cash__print-totals-value']}>{formatCurrency(cashData?.total_expenses ?? 0)}</span>
            </div>
            <div className={s['cash__print-totals-cell']}>
              <span className={s['cash__print-totals-label']}>Saldo Actual</span>
              <span className={s['cash__print-totals-value']}>{formatCurrency(cashData?.current_balance ?? 0)}</span>
            </div>
            <div className={`${s['cash__print-totals-cell']} ${s['cash__print-totals-cell--highlight']}`}>
              <span className={s['cash__print-totals-label']}>Efectivo Real en Cajón</span>
              <span className={s['cash__print-totals-value']}>{formatCurrency(cashData?.real_cash ?? 0)}</span>
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
      </div>

      <IncomeModal isOpen={showIncome} onClose={() => setShowIncome(false)} onSubmit={handleAddIncome} />
      <ExpenseModal isOpen={showExpense} onClose={() => setShowExpense(false)} onSubmit={handleAddExpense} />

      <ConfirmDialog open={!!deleteId} onCancel={() => setDeleteId(null)}
        onConfirm={handleDeleteMovement}
        title="Eliminar movimiento"
        message="¿Estás seguro de eliminar este movimiento de caja?"
        confirmLabel="Eliminar"
        danger />

      <CloseCashModal isOpen={showClose} onClose={() => setShowClose(false)} onConfirm={handleCloseCash} numero={boxNumber} totales={cashData} />
    </div>
  );
}
