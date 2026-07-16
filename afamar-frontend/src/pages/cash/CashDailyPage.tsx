import React, { useState, useEffect } from 'react';
import { Printer, Lock, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { getDailyCash, createCashMovement, deleteCashMovement, setPreviousBalance, closeDailyCash } from '@/api/resources/cash';
import { useGet } from '../../api/hooks';
import { formatCurrency, todayLocalISO } from '../../utils/formatters';
import { folderStatusClass } from '../../constants';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import PreviousBalanceCard from '../../components/cash/PreviousBalanceCard/PreviousBalanceCard';
import { CashMovementTable } from '../../components/cash/CashMovementTable/CashMovementTable';
import CashTotalCards from '../../components/cash/CashTotalCards/CashTotalCards';
import IncomeModal from '../../components/cash/IncomeModal/IncomeModal';
import ExpenseModal from '../../components/cash/ExpenseModal/ExpenseModal';
import CloseCashModal from '../../components/cash/CloseCashModal/CloseCashModal';
import { useNotify } from '../../context/NotificationContext';
import styles from './CashDailyPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function CashDailyPage() {
  const today = todayLocalISO();
  const [date, setDate] = useState<string>(today);
  const [previousBalance, setPreviousBalanceState] = useState<number>(0);
  const [movements, setMovements] = useState<Record<string, unknown>[]>([]);
  const [previousBalanceEdit, setPreviousBalanceEdit] = useState<boolean>(false);

  const [showIncome, setShowIncome] = useState<boolean>(false);
  const [showExpense, setShowExpense] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [showClose, setShowClose] = useState<boolean>(false);
  const [closed, setClosed] = useState<boolean>(false);

  const notify = useNotify();

  const { data: cashData, loading, load: loadCaja } = useGet<Record<string, unknown>>(
    ['cash', 'daily', date],
    async () => {
      const res = await getDailyCash(date);
      return (res.data as Record<string, unknown>) || {};
    }
  );

  useEffect(() => {
    if (!cashData) return;
    const movs = (cashData.movements as Record<string, unknown>[]) || [];
    setPreviousBalanceState((cashData.previous_balance as number) ?? 0);
    setMovements(movs);
    setClosed((cashData.is_closed as boolean) || false);
  }, [cashData]);

  const handleSavePreviousBalance = async () => {
    try {
      await setPreviousBalance(date, previousBalance);
      setPreviousBalanceEdit(false);
      loadCaja();
    } catch (err: unknown) {
      notify((err as Error).message || 'Error al guardar saldo anterior', 'error');
    }
  };

  const handleAddIncome = async (data: Record<string, unknown>) => {
    try {
      await createCashMovement({ ...data, date: date });
      setShowIncome(false);
      await loadCaja();
    } catch (err: unknown) {
      notify((err as Error).message || 'Error al registrar ingreso', 'error');
    }
  };

  const handleAddExpense = async (data: Record<string, unknown>) => {
    try {
      await createCashMovement({ ...data, date: date });
      setShowExpense(false);
      await loadCaja();
    } catch (err: unknown) {
      notify((err as Error).message || 'Error al registrar egreso', 'error');
    }
  };

  const handleDeleteMovement = async () => {
    if (!deleteId) return;
    try {
      await deleteCashMovement(deleteId);
      setDeleteId(null);
      await loadCaja();
    } catch (err: unknown) {
      notify((err as Error).message || 'Error al eliminar movimiento', 'error');
    }
  };

  const handleCloseCash = async (notes: string) => {
    try {
      await closeDailyCash(date, notes || undefined);
      setShowClose(false);
      await loadCaja();
    } catch (err: unknown) {
      notify((err as Error).message || 'Error al cerrar la caja', 'error');
    }
  };

  const handlePrint = () => window.print();

  const incomes = movements.filter((m: Record<string, unknown>) => m.type === 'INCOME');
  const expenses = movements.filter((m: Record<string, unknown>) => m.type === 'EXPENSE');

  const totalIngresos = incomes.reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const totalSalidas = expenses.reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const suma = (previousBalance || 0) + totalIngresos;
  const currentBalance = suma - totalSalidas;

  const cashIncome = incomes
    .filter((m: Record<string, unknown>) => ((m.payment_method as string) || '').toUpperCase() === 'CASH')
    .reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const totalBankTransfers = expenses
    .filter((m: Record<string, unknown>) => (m.expense_type as string) === 'BANK_TRANSFER')
    .reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const efectivoReal = (previousBalance || 0) + cashIncome - (totalSalidas - totalBankTransfers);

  const isToday = date === today;

  return (
    <div className={s['cash']}>
      <style>{`
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
          <p className={s['cash__print-date']}>Fecha: {date}</p>
          <hr className={s['cash__print-hr']} />
        </div>

        {/* Header */}
        <div className={s['cash__page-header']}>
          <h1 className={`no-print ${s['cash__page-header-title']}`}>Caja Diaria</h1>
          <div className={`no-print ${s['cash__controls']}`}>
            <input
              type="date"
              className={`input ${s['cash__date-input']}`}
              value={date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
            />
            {!isToday && (
              <button className="btn btn-outline" onClick={() => setDate(today)}>Hoy</button>
            )}
            {isToday && !closed && (
              <button className={`btn btn-danger ${s['cash__controls-btn']}`}
                onClick={() => setShowClose(true)}>
                <Lock size={14} className={s['cash__icon-inline']} /> Cerrar Caja del Día
              </button>
            )}
            {closed && (
              <span className={`badge badge-finished ${s['cash__badge']}`}>Cerrada</span>
            )}
            <button className={`btn btn-outline no-print-keep ${s['cash__controls-btn']}`}
              onClick={handlePrint}>
              <Printer size={14} className={s['cash__icon-inline']} /> Imprimir Reporte
            </button>
          </div>
        </div>

        <PreviousBalanceCard
          previousBalance={previousBalance}
          cerrada={closed}
          editMode={previousBalanceEdit}
          onEdit={() => setPreviousBalanceEdit(true)}
          onCancel={() => { setPreviousBalanceEdit(false); loadCaja(); }}
          onSave={handleSavePreviousBalance}
          onChange={(v: number) => setPreviousBalanceState(v)}
        />

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
                  { key: 'order_number', label: 'N° Orden', width: 90, render: (m) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{(m as Record<string, unknown>).order_number as string || '-'}</span> },
                  { key: 'client_name', label: 'Cliente', render: (m) => ((m as Record<string, unknown>).client_name as string) || '-' },
                  { key: 'amount', label: 'Monto', width: 110, render: (m) => <span className={s['cash__amount--income']}>{formatCurrency((m as Record<string, unknown>).amount as number)}</span> },
                  { key: 'remaining_balance', label: 'Saldo Restante', width: 110, render: (m) => {
                      const v = (m as Record<string, unknown>).remaining_balance as number | null | undefined;
                      return v !== null && v !== undefined
                        ? <span className={v > 0 ? s['cash__amount--expense'] : s['cash__balance--positive']}>{formatCurrency(v)}</span>
                        : '-';
                    }
                  },
                  { key: 'payment_method', label: 'Pago', width: 100, render: (m) => {
                      const pm = (m as Record<string, unknown>).payment_method as string;
                      const cls = pm === 'CASH' ? 'badge-approved' : pm === 'TRANSFER' ? 'badge-production' : 'badge-pending';
                      return <span className={`badge ${cls}`}>{pm || '-'}</span>;
                    }
                  },
                  { key: 'folder_status', label: 'Carpeta', width: 90, render: (m) => {
                      const fs = (m as Record<string, unknown>).folder_status as string | undefined;
                      return fs ? <span className={`badge ${folderStatusClass(fs)}`}>{fs}</span> : '-';
                    }
                  },
                ]}
                closed={closed}
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
                  { key: 'description', label: 'Concepto', render: (m) => ((m as Record<string, unknown>).description as string) || '-' },
                  { key: 'amount', label: 'Monto', width: 110, render: (m) => <span className={s['cash__amount--expense']}>{formatCurrency((m as Record<string, unknown>).amount as number)}</span> },
                  { key: 'expense_type', label: 'Tipo', width: 90, render: (m) => {
                      const et = (m as Record<string, unknown>).expense_type as string;
                      const cls = et === 'GENERAL' ? 'badge-rejected' : 'badge-production';
                      return <span className={`badge ${cls}`}>{et || 'GENERAL'}</span>;
                    }
                  },
                ]}
                closed={closed}
                onAdd={() => setShowExpense(true)}
                onDelete={(id: number) => setDeleteId(id)}
              />
            </div>

            <CashTotalCards suma={suma} totalSalidas={totalSalidas} currentBalance={currentBalance} efectivoReal={efectivoReal} />
          </>
        )}

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

      <CloseCashModal isOpen={showClose} onClose={() => setShowClose(false)} onConfirm={handleCloseCash} fecha={date} />
    </div>
  );
}