import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Lock, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { getDailyCash, createCashMovement, deleteCashMovement, setPreviousBalance, closeDailyCash } from '@/api/resources/cash';
import { useGet } from '../../api/hooks';
import { formatCurrency } from '../../utils/formatters';
import { folderStatusClass } from '../../constants';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import PreviousBalanceCard from '../../components/features/cash/PreviousBalanceCard';
import { CashMovementTable } from '../../components/features/cash/CashMovementTable';
import CashTotalCards from '../../components/features/cash/CashTotalCards';
import IncomeModal from '../../components/features/cash/IncomeModal';
import ExpenseModal from '../../components/features/cash/ExpenseModal';
import CloseCashModal from '../../components/features/cash/CloseCashModal';
import styles from './CashDailyPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function CashDailyPage() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(today);
  const [previousBalance, setPreviousBalanceState] = useState<number>(0);
  const [movements, setMovements] = useState<Record<string, unknown>[]>([]);
  const [previousBalanceEdit, setPreviousBalanceEdit] = useState<boolean>(false);

  const [showIncome, setShowIncome] = useState<boolean>(false);
  const [showExpense, setShowExpense] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [showClose, setShowClose] = useState<boolean>(false);
  const [closed, setClosed] = useState<boolean>(false);

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
    } catch {
      alert('Error al guardar saldo anterior');
    }
  };

  const handleAddIncome = async (data: Record<string, unknown>) => {
    try {
      await createCashMovement({ ...data, date: date });
      setShowIncome(false);
      await loadCaja();
    } catch {
      alert('Error al registrar ingreso');
    }
  };

  const handleAddExpense = async (data: Record<string, unknown>) => {
    try {
      await createCashMovement({ ...data, date: date });
      setShowExpense(false);
      await loadCaja();
    } catch {
      alert('Error al registrar egreso');
    }
  };

  const handleDeleteMovement = async () => {
    if (!deleteId) return;
    try {
      await deleteCashMovement(deleteId);
      setDeleteId(null);
      await loadCaja();
    } catch {
      alert('Error al eliminar movimiento');
    }
  };

  const handleCloseCash = async (notes: string) => {
    try {
      await closeDailyCash(date, notes || undefined);
      setShowClose(false);
      await loadCaja();
    } catch {
      alert('Error al cerrar la caja');
    }
  };

  const handlePrint = () => window.print();

  const ingresos = movements.filter((m: Record<string, unknown>) => m.type === 'INCOME');
  const egresos = movements.filter((m: Record<string, unknown>) => m.type === 'EXPENSE');

  const totalIngresos = ingresos.reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const totalSalidas = egresos.reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const suma = (previousBalance || 0) + totalIngresos;
  const saldoActualNum = suma - totalSalidas;

  const ingresosEfectivo = ingresos
    .filter((m: Record<string, unknown>) => ((m.payment_method as string) || '').toUpperCase() === 'CASH')
    .reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const totalTB = egresos
    .filter((m: Record<string, unknown>) => (m.expense_type as string) === 'BANK_TRANSFER')
    .reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const efectivoReal = (previousBalance || 0) + ingresosEfectivo - (totalSalidas - totalTB);

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
        <div className="print-only" style={{ textAlign: 'center', marginBottom: 20 } as React.CSSProperties}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 } as React.CSSProperties}>CIERRE DE CAJA</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' } as React.CSSProperties}>Fecha: {date}</p>
          <hr style={{ margin: '10px 0', border: 'none', borderTop: '2px solid #000' } as React.CSSProperties} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } as React.CSSProperties}>
          <h1 className="no-print" style={{ fontSize: 24, fontWeight: 700 } as React.CSSProperties}>Caja Diaria</h1>
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties}>
            <input
              type="date"
              className="input"
              style={{ width: 180 } as React.CSSProperties}
              value={date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
            />
            {!isToday && (
              <button className="btn btn-outline" onClick={() => setDate(today)}>Hoy</button>
            )}
            {isToday && !closed && (
              <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 13 } as React.CSSProperties}
                onClick={() => setShowClose(true)}>
                <Lock size={14} style={{ marginRight: 4 } as React.CSSProperties} /> Cerrar Caja del Día
              </button>
            )}
            {closed && (
              <span className="badge badge-finished" style={{ fontSize: 13 } as React.CSSProperties}>Cerrada</span>
            )}
            <button className="btn btn-outline no-print-keep" style={{ padding: '6px 14px', fontSize: 13 } as React.CSSProperties}
              onClick={handlePrint}>
              <Printer size={14} style={{ marginRight: 4 } as React.CSSProperties} /> Imprimir Reporte
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 } as React.CSSProperties}>
              <CashMovementTable
                title="Entradas (Ingresos)"
                titleColor="#16a34a"
                icon={<ArrowUpCircle size={20} />}
                addLabel="Agregar Ingreso"
                emptyMessage="Sin ingresos registrados"
                movements={ingresos}
                columns={[
                  { key: 'order_number', label: 'N° Orden', width: 90, render: (m) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{(m as Record<string, unknown>).order_number as string || '-'}</span> },
                  { key: 'client_name', label: 'Cliente', render: (m) => ((m as Record<string, unknown>).client_name as string) || '-' },
                  { key: 'amount', label: 'Monto', width: 110, render: (m) => <span style={{ fontWeight: 600, color: '#16a34a' }}>{formatCurrency((m as Record<string, unknown>).amount as number)}</span> },
                  { key: 'remaining_balance', label: 'Saldo Restante', width: 110, render: (m) => {
                      const v = (m as Record<string, unknown>).remaining_balance as number | null | undefined;
                      return v !== null && v !== undefined
                        ? <span style={{ fontWeight: 600, color: v > 0 ? '#dc2626' : '#94a3b8' }}>{formatCurrency(v)}</span>
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
                movements={egresos}
                columns={[
                  { key: 'description', label: 'Concepto', render: (m) => ((m as Record<string, unknown>).description as string) || '-' },
                  { key: 'amount', label: 'Monto', width: 110, render: (m) => <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatCurrency((m as Record<string, unknown>).amount as number)}</span> },
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

            <CashTotalCards suma={suma} totalSalidas={totalSalidas} saldoActualNum={saldoActualNum} efectivoReal={efectivoReal} />
          </>
        )}

        <div className="print-only" style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#94a3b8' } as React.CSSProperties}>
          Reporte generado el {new Date().toLocaleDateString('es-AR')} a las {new Date().toLocaleTimeString('es-AR')}
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
