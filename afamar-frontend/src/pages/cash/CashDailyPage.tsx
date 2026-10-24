import React, { useState, useEffect, useMemo } from 'react';
import { Printer, Lock } from 'lucide-react';
import { getCurrentCash, createCashMovement, deleteCashMovement, setPreviousBalance, closeCash } from '@/api/resources/cash';
import type { CashMovePayload } from '@/api/resources/cash';
import type { CashRegister, CashMovement } from '../../types/cash';
import type { WorkOrderListItem } from '../../types/workOrder';
import { useGet } from '../../api/hooks';
import {
  type WorkOrdersById,
} from '../../utils/cashMovementFormatters';
import { parseApiError } from '../../utils/error';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import PreviousBalanceCard from '../../components/cash/PreviousBalanceCard/PreviousBalanceCard';
import CashTotalCards from '../../components/cash/CashTotalCards/CashTotalCards';
import IncomeModal from '../../components/cash/IncomeModal/IncomeModal';
import ExpenseModal from '../../components/cash/ExpenseModal/ExpenseModal';
import CloseCashModal from '../../components/cash/CloseCashModal/CloseCashModal';
import { getWorkOrders } from '@/api/resources/workOrders';
import { useNotify } from '../../context/NotificationContext';
import { formatDateTime } from './CashDailyPage.format';
import { CashPrintHeader } from './CashDailyPage.PrintHeader';
import { CashMovements } from './CashDailyPage.Movements';
import { CashPrintSummary } from './CashDailyPage.PrintSummary';
import styles from './CashDailyPage.module.css';

const s = styles as unknown as Record<string, string>;

/** Cash register page (open box) — movements, totals and the printable
 *  closing report.
 *
 *  This file is the ORCHESTRATOR (see ADR 0009): the data fetching, the
 *  state and the handlers live here while the UI blocks are delegated to
 *  focused sub-components:
 *
 *   - `CashDailyPage.PrintHeader.tsx`  — print-only report header.
 *   - `CashDailyPage.Movements.tsx`    — Entradas / Salidas tables.
 *   - `CashDailyPage.PrintSummary.tsx` — print-only totals + signatures.
 *   - `CashDailyPage.format.ts`        — shared formatters.
 */
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
        <CashPrintHeader boxNumber={boxNumber} openedAt={openedAt} closedAt={closedAt} />

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
            <CashMovements
              incomes={incomes}
              expenses={expenses}
              workOrdersById={workOrdersById}
              isClosed={isClosed}
              onAddIncome={() => setShowIncome(true)}
              onAddExpense={() => setShowExpense(true)}
              onDelete={(id: number) => setDeleteId(id)}
            />

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

        <CashPrintSummary
          previousBalance={cashData?.previous_balance ?? 0}
          totalIncome={cashData?.total_income ?? 0}
          totalExpenses={cashData?.total_expenses ?? 0}
          currentBalance={cashData?.current_balance ?? 0}
          realCash={cashData?.real_cash ?? 0}
        />
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
