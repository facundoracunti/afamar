import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Lock } from 'lucide-react';
import { getDailyCash, createCashMovement, deleteCashMovement, setPreviousBalance, closeDailyCash } from '@/api/resources/cash';
import { useGet } from '../../api/hooks';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import SaldoAnteriorCard from '../../components/caja/SaldoAnteriorCard';
import IngresosTable from '../../components/caja/IngresosTable';
import EgresosTable from '../../components/caja/EgresosTable';
import CajaTotalCards from '../../components/caja/CajaTotalCards';
import IngresoModal from '../../components/caja/IngresoModal';
import EgresoModal from '../../components/caja/EgresoModal';
import CerrarCajaModal from '../../components/caja/CerrarCajaModal';
import styles from './CashDailyPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function CajaDiaria() {
  const today = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState<string>(today);
  const [saldoAnterior, setSaldoAnterior] = useState<number>(0);
  const [movimientos, setMovimientos] = useState<Record<string, unknown>[]>([]);
  const [saldoAnteriorEdit, setSaldoAnteriorEdit] = useState<boolean>(false);

  const [showIngreso, setShowIngreso] = useState<boolean>(false);
  const [showEgreso, setShowEgreso] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [showCerrar, setShowCerrar] = useState<boolean>(false);
  const [cerrada, setCerrada] = useState<boolean>(false);

  const { data: cajaData, loading, load: loadCaja } = useGet<Record<string, unknown>>(
    ['cash', 'daily', fecha],
    async () => {
      const res = await getDailyCash(fecha);
      return (res.data as Record<string, unknown>) || {};
    }
  );

  useEffect(() => {
    if (!cajaData) return;
    const movs = (cajaData.movements as Record<string, unknown>[]) || [];
    setSaldoAnterior((cajaData.previous_balance as number) ?? 0);
    setMovimientos(movs);
    setCerrada((cajaData.is_closed as boolean) || false);
  }, [cajaData]);

  const handleSaveSaldoAnterior = async () => {
    try {
      await setPreviousBalance(fecha, saldoAnterior);
      setSaldoAnteriorEdit(false);
      loadCaja();
    } catch {
      alert('Error al guardar saldo anterior');
    }
  };

  const handleAddIngreso = async (data: Record<string, unknown>) => {
    try {
      await createCashMovement({ ...data, date: fecha });
      setShowIngreso(false);
      await loadCaja();
    } catch {
      alert('Error al registrar ingreso');
    }
  };

  const handleAddEgreso = async (data: Record<string, unknown>) => {
    try {
      await createCashMovement({ ...data, date: fecha });
      setShowEgreso(false);
      await loadCaja();
    } catch {
      alert('Error al registrar egreso');
    }
  };

  const handleDeleteMov = async () => {
    if (!deleteId) return;
    try {
      await deleteCashMovement(deleteId);
      setDeleteId(null);
      await loadCaja();
    } catch {
      alert('Error al eliminar movimiento');
    }
  };

  const handleCerrarCaja = async (notes: string) => {
    try {
      await closeDailyCash(fecha, notes || undefined);
      setShowCerrar(false);
      await loadCaja();
    } catch {
      alert('Error al cerrar la caja');
    }
  };

  const handlePrint = () => window.print();

  const ingresos = movimientos.filter((m: Record<string, unknown>) => m.type === 'INCOME');
  const egresos = movimientos.filter((m: Record<string, unknown>) => m.type === 'EXPENSE');

  const totalIngresos = ingresos.reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const totalSalidas = egresos.reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const suma = (saldoAnterior || 0) + totalIngresos;
  const saldoActualNum = suma - totalSalidas;

  const ingresosEfectivo = ingresos
    .filter((m: Record<string, unknown>) => ((m.payment_method as string) || '').toUpperCase() === 'CASH')
    .reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const totalTB = egresos
    .filter((m: Record<string, unknown>) => (m.expense_type as string) === 'BANK_TRANSFER')
    .reduce((s: number, m: Record<string, unknown>) => s + ((m.amount as number) || 0), 0);
  const efectivoReal = (saldoAnterior || 0) + ingresosEfectivo - (totalSalidas - totalTB);

  const isToday = fecha === today;

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
          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' } as React.CSSProperties}>Fecha: {fecha}</p>
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
              value={fecha}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFecha(e.target.value)}
            />
            {!isToday && (
              <button className="btn btn-outline" onClick={() => setFecha(today)}>Hoy</button>
            )}
            {isToday && !cerrada && (
              <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 13 } as React.CSSProperties}
                onClick={() => setShowCerrar(true)}>
                <Lock size={14} style={{ marginRight: 4 } as React.CSSProperties} /> Cerrar Caja del Día
              </button>
            )}
            {cerrada && (
              <span className="badge badge-finished" style={{ fontSize: 13 } as React.CSSProperties}>Cerrada</span>
            )}
            <button className="btn btn-outline no-print-keep" style={{ padding: '6px 14px', fontSize: 13 } as React.CSSProperties}
              onClick={handlePrint}>
              <Printer size={14} style={{ marginRight: 4 } as React.CSSProperties} /> Imprimir Reporte
            </button>
          </div>
        </div>

        <SaldoAnteriorCard
          saldoAnterior={saldoAnterior}
          cerrada={cerrada}
          editMode={saldoAnteriorEdit}
          onEdit={() => setSaldoAnteriorEdit(true)}
          onCancel={() => { setSaldoAnteriorEdit(false); loadCaja(); }}
          onSave={handleSaveSaldoAnterior}
          onChange={(v: number) => setSaldoAnterior(v)}
        />

        {loading ? <Loading /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 } as React.CSSProperties}>
              <IngresosTable ingresos={ingresos} cerrada={cerrada} onDelete={(id: number) => setDeleteId(id)} onAdd={() => setShowIngreso(true)} />
              <EgresosTable egresos={egresos} cerrada={cerrada} onDelete={(id: number) => setDeleteId(id)} onAdd={() => setShowEgreso(true)} />
            </div>

            <CajaTotalCards suma={suma} totalSalidas={totalSalidas} saldoActualNum={saldoActualNum} efectivoReal={efectivoReal} />
          </>
        )}

        <div className="print-only" style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#94a3b8' } as React.CSSProperties}>
          Reporte generado el {new Date().toLocaleDateString('es-AR')} a las {new Date().toLocaleTimeString('es-AR')}
        </div>
      </div>

      <IngresoModal isOpen={showIngreso} onClose={() => setShowIngreso(false)} onSubmit={handleAddIngreso} />
      <EgresoModal isOpen={showEgreso} onClose={() => setShowEgreso(false)} onSubmit={handleAddEgreso} />

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteMov}
        title="Eliminar movimiento"
        message="¿Estás seguro de eliminar este movimiento de caja?" />

      <CerrarCajaModal isOpen={showCerrar} onClose={() => setShowCerrar(false)} onConfirm={handleCerrarCaja} fecha={fecha} />
    </div>
  );
}
