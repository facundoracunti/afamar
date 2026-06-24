import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Search, ArrowUpCircle, ArrowDownCircle, Wallet, Banknote, Printer, Lock } from 'lucide-react';
import { getCajaDiaria, createMovimientoCaja, deleteMovimientoCaja, putSaldoAnterior, getOrdenes, cerrarCaja } from '../../services/api';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import Loading from '../common/Loading';
import { formatCurrency } from '../../utils/formatters';
import type { MovimientoCaja } from '../../types/caja';

const FORMAS_PAGO: string[] = ['Efectivo', 'Transferencia', 'Tarjeta'];
const TIPOS_EGRESO: string[] = ['Gasto', 'Transferencia Banco'];

const ESTADO_CARPETA_MAP: Record<string, string> = {
  'MEDICION': 'Medición',
  'TALLER': 'Taller',
  'TERMINADA': 'Terminada',
  'ENTREGADA': 'Entregada',
};

const estadoCarpetaClass = (estado: string): string => {
  const map: Record<string, string> = {
    'Medición': 'badge-pending',
    'Taller': 'badge-production',
    'Terminada': 'badge-finished',
    'Entregada': 'badge-finished',
  };
  return map[estado] || 'badge-pending';
};

export default function CajaDiaria() {
  const today = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState<string>(today);
  const [saldoAnterior, setSaldoAnterior] = useState<number>(0);
  const [movimientos, setMovimientos] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saldoAnteriorEdit, setSaldoAnteriorEdit] = useState<boolean>(false);

  const [showIngreso, setShowIngreso] = useState<boolean>(false);
  const [showEgreso, setShowEgreso] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [ingresoForm, setIngresoForm] = useState<Record<string, unknown>>({
    monto: '', forma_pago: 'Efectivo', estado_carpeta: 'Medición',
    orden_numero: '', cliente_nombre: '', orden_id: null, orden_total: null,
  });
  const [egresoForm, setEgresoForm] = useState<Record<string, unknown>>({
    concepto: '', monto: '', tipo_egreso: 'Gasto',
  });

  const [showCerrar, setShowCerrar] = useState<boolean>(false);
  const [cerrarObs, setCerrarObs] = useState<string>('');
  const [cerrada, setCerrada] = useState<boolean>(false);

  const [ordenSearch, setOrdenSearch] = useState<string>('');
  const [ordenResults, setOrdenResults] = useState<Record<string, unknown>[]>([]);
  const [showOrdenSearch, setShowOrdenSearch] = useState<boolean>(false);

  const loadCaja = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCajaDiaria(fecha);
      if (res.data) {
        const movs = (res.data.movimientos as Record<string, unknown>[]) || [];
        setSaldoAnterior(prev => (res.data.saldo_anterior as number) ?? prev);
        setMovimientos(movs);
        setCerrada((res.data.cerrada as boolean) || false);

        if (!(res.data.cerrada as boolean) && movs.length === 0 && !res.data.saldo_anterior) {
          const prev = new Date(fecha);
          prev.setDate(prev.getDate() - 1);
          const prevStr = prev.toISOString().split('T')[0];
          try {
            const prevRes = await getCajaDiaria(prevStr);
            const prevSaldo = (prevRes.data?.saldo_actual as number) || 0;
            if (prevSaldo) {
              await putSaldoAnterior(fecha, prevSaldo);
              setSaldoAnterior(prevSaldo);
            }
          } catch {
            // No hay caja del día anterior
          }
        }
      }
    } catch {
      setMovimientos([]);
      setCerrada(false);
    } finally {
      setLoading(false);
    }
  }, [fecha, today]);

  useEffect(() => { loadCaja(); }, [loadCaja]);

  const handleSaveSaldoAnterior = async () => {
    try {
      await putSaldoAnterior(fecha, saldoAnterior);
      setSaldoAnteriorEdit(false);
      await loadCaja();
    } catch (err: unknown) {
      alert('Error al guardar saldo anterior');
    }
  };

  const searchOrdenes = async (q: string) => {
    setOrdenSearch(q);
    if (q.length < 2) { setOrdenResults([]); return; }
    try {
      const res = await getOrdenes({ search: q, limit: 10 });
      setOrdenResults((res.data as Record<string, unknown>[]) || []);
    } catch { setOrdenResults([]); }
  };

  const selectOrden = (orden: Record<string, unknown>) => {
    setIngresoForm({
      ...ingresoForm,
      orden_id: orden.id as number,
      orden_numero: orden.numero as string,
      cliente_nombre: (orden.cliente_nombre as string) || '',
      monto: (orden.total as number) || '',
      estado_carpeta: (ESTADO_CARPETA_MAP[orden.estado as string] as string) || (orden.estado as string) || '',
      orden_total: (orden.total as number) || null,
    });
    setShowOrdenSearch(false);
    setOrdenSearch('');
    setOrdenResults([]);
  };

  const handleAddIngreso = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ingresoForm.monto || Number(ingresoForm.monto) <= 0) return;
    try {
      await createMovimientoCaja({
        fecha,
        tipo: 'INGRESO',
        monto: Number(ingresoForm.monto),
        concepto: ingresoForm.orden_numero
          ? `Pago ${ingresoForm.orden_numero} - ${ingresoForm.cliente_nombre}`
          : `Ingreso manual - ${(ingresoForm.cliente_nombre as string) || ''}`,
        forma_pago: ingresoForm.forma_pago,
        estado_carpeta: ingresoForm.estado_carpeta,
        orden_id: ingresoForm.orden_id,
        orden_numero: ingresoForm.orden_numero,
        orden_total: ingresoForm.orden_total,
        cliente_nombre: ingresoForm.cliente_nombre,
      });
      setShowIngreso(false);
      setIngresoForm({ monto: '', forma_pago: 'Efectivo', estado_carpeta: 'Medición', orden_numero: '', cliente_nombre: '', orden_id: null, orden_total: null });
      await loadCaja();
    } catch (err: unknown) {
      alert('Error al registrar ingreso');
    }
  };

  const handleAddEgreso = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!egresoForm.monto || Number(egresoForm.monto) <= 0) return;
    try {
      await createMovimientoCaja({
        fecha,
        tipo: 'EGRESO',
        monto: Number(egresoForm.monto),
        concepto: egresoForm.concepto as string,
        tipo_egreso: egresoForm.tipo_egreso as string,
      });
      setShowEgreso(false);
      setEgresoForm({ concepto: '', monto: '', tipo_egreso: 'Gasto' });
      await loadCaja();
    } catch (err: unknown) {
      alert('Error al registrar egreso');
    }
  };

  const handleDeleteMov = async () => {
    if (!deleteId) return;
    try {
      await deleteMovimientoCaja(deleteId);
      setDeleteId(null);
      await loadCaja();
    } catch {
      alert('Error al eliminar movimiento');
    }
  };

  const handleCerrarCaja = async () => {
    try {
      await cerrarCaja(fecha, cerrarObs || undefined);
      setShowCerrar(false);
      setCerrarObs('');
      await loadCaja();
    } catch {
      alert('Error al cerrar la caja');
    }
  };

  const handlePrint = () => window.print();

  const ingresos = movimientos.filter((m: Record<string, unknown>) => m.tipo === 'INGRESO');
  const egresos = movimientos.filter((m: Record<string, unknown>) => m.tipo === 'EGRESO');

  const totalIngresos = ingresos.reduce((s: number, m: Record<string, unknown>) => s + ((m.monto as number) || 0), 0);
  const totalSalidas = egresos.reduce((s: number, m: Record<string, unknown>) => s + ((m.monto as number) || 0), 0);
  const suma = (saldoAnterior || 0) + totalIngresos;
  const saldoActualNum = suma - totalSalidas;

  const ingresosEfectivo = ingresos
    .filter((m: Record<string, unknown>) => ((m.forma_pago as string) || '').toLowerCase() === 'efectivo')
    .reduce((s: number, m: Record<string, unknown>) => s + ((m.monto as number) || 0), 0);
  const totalTB = egresos
    .filter((m: Record<string, unknown>) => (m.tipo_egreso as string) === 'Transferencia Banco')
    .reduce((s: number, m: Record<string, unknown>) => s + ((m.monto as number) || 0), 0);
  const efectivoReal = (saldoAnterior || 0) + ingresosEfectivo - (totalSalidas - totalTB);

  const isToday = fecha === today;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-table th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-card { border: 1px solid #000 !important; padding: 16px !important; margin-bottom: 12px !important; }
          .print-total-card { border: 2px solid #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-only { display: none; }
      `}</style>
      <div id="print-area">
        {/* Print header (solo visible al imprimir) */}
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

        {/* Saldo Anterior */}
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 } as React.CSSProperties}>
        <Wallet size={22} style={{ color: '#64748b' } as React.CSSProperties} />
        <span style={{ fontWeight: 600, fontSize: 15, color: '#475569' } as React.CSSProperties}>Saldo Anterior:</span>
        {saldoAnteriorEdit ? (
          <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' } as React.CSSProperties}>
            <input
              className="input"
              type="number"
              step="0.01"
              style={{ width: 160 } as React.CSSProperties}
              value={saldoAnterior}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaldoAnterior(Number(e.target.value))}
              autoFocus
            />
            <button className="btn btn-primary" style={{ padding: '6px 14px' } as React.CSSProperties} onClick={handleSaveSaldoAnterior}>Guardar</button>
            <button className="btn btn-outline" style={{ padding: '6px 14px' } as React.CSSProperties} onClick={() => { setSaldoAnteriorEdit(false); loadCaja(); }}>Cancelar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties}>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#1e293b' } as React.CSSProperties}>{formatCurrency(saldoAnterior)}</span>
            {!cerrada && (
              <button className="btn btn-outline no-print" style={{ padding: '4px 10px', fontSize: 12 } as React.CSSProperties} onClick={() => setSaldoAnteriorEdit(true)}>Editar</button>
            )}
          </div>
        )}
      </div>

      {loading ? <Loading /> : (
        <>
          {/* Two-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 } as React.CSSProperties}>
            {/* Left: Ingresos */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' } as React.CSSProperties}>
              <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties}>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a' } as React.CSSProperties}>
                  <ArrowUpCircle size={20} /> Entradas (Ingresos)
                </h3>
                <button className="btn btn-success no-print" style={{ padding: '6px 12px', fontSize: 13 } as React.CSSProperties}
                  disabled={cerrada} onClick={() => setShowIngreso(true)}>
                  <Plus size={14} /> Agregar Ingreso
                </button>
              </div>
              <div className="table-container" style={{ marginTop: 12 } as React.CSSProperties}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 90 } as React.CSSProperties}>N° Orden</th>
                      <th>Cliente</th>
                      <th style={{ width: 110 } as React.CSSProperties}>Monto</th>
                      <th style={{ width: 110 } as React.CSSProperties}>Saldo Restante</th>
                      <th style={{ width: 100 } as React.CSSProperties}>Pago</th>
                      <th style={{ width: 90 } as React.CSSProperties}>Carpeta</th>
                      <th className="no-print" style={{ width: 40 } as React.CSSProperties}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingresos.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' } as React.CSSProperties}>Sin ingresos registrados</td></tr>
                    ) : (
                      ingresos.map((m: Record<string, unknown>) => (
                        <tr key={m.id as number}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 } as React.CSSProperties}>{(m.orden_numero as string) || '-'}</td>
                          <td>{(m.cliente_nombre as string) || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#16a34a' } as React.CSSProperties}>{formatCurrency(m.monto as number)}</td>
                          <td style={{ fontWeight: 600, color: (m.saldo_restante as number) > 0 ? '#dc2626' : '#94a3b8' } as React.CSSProperties}>
                            {m.saldo_restante !== null && m.saldo_restante !== undefined ? formatCurrency(m.saldo_restante as number) : '-'}
                          </td>
                          <td>
                            <span className={`badge ${(m.forma_pago as string) === 'Efectivo' ? 'badge-approved' : (m.forma_pago as string) === 'Transferencia' ? 'badge-production' : 'badge-pending'}`}>
                              {(m.forma_pago as string) || '-'}
                            </span>
                          </td>
                          <td>
                            {m.estado_carpeta ? (
                              <span className={`badge ${estadoCarpetaClass(m.estado_carpeta as string)}`}>{(m.estado_carpeta as string)}</span>
                            ) : '-'}
                          </td>
                          <td className="no-print">
                            <button className="btn" style={{ padding: '3px 6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' } as React.CSSProperties}
                              onClick={() => setDeleteId(m.id as number)} title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Egresos */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' } as React.CSSProperties}>
              <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties}>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' } as React.CSSProperties}>
                  <ArrowDownCircle size={20} /> Salidas (Egresos)
                </h3>
                <button className="btn btn-danger no-print" style={{ padding: '6px 12px', fontSize: 13 } as React.CSSProperties}
                  disabled={cerrada} onClick={() => setShowEgreso(true)}>
                  <Plus size={14} /> Agregar Egreso
                </button>
              </div>
              <div className="table-container" style={{ marginTop: 12 } as React.CSSProperties}>
                <table>
                  <thead>
                        <tr>
                          <th>Concepto</th>
                          <th style={{ width: 110 } as React.CSSProperties}>Monto</th>
                          <th style={{ width: 90 } as React.CSSProperties}>Tipo</th>
                          <th className="no-print" style={{ width: 40 } as React.CSSProperties}></th>
                        </tr>
                  </thead>
                  <tbody>
                    {egresos.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' } as React.CSSProperties}>Sin egresos registrados</td></tr>
                    ) : (
                      egresos.map((m: Record<string, unknown>) => (
                        <tr key={m.id as number}>
                          <td>{(m.concepto as string) || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#dc2626' } as React.CSSProperties}>{formatCurrency(m.monto as number)}</td>
                          <td>
                            <span className={`badge ${(m.tipo_egreso as string) === 'Gasto' ? 'badge-rejected' : 'badge-production'}`}>
                              {(m.tipo_egreso as string) || 'Gasto'}
                            </span>
                          </td>
                          <td className="no-print">
                            <button className="btn" style={{ padding: '3px 6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' } as React.CSSProperties}
                              onClick={() => setDeleteId(m.id as number)} title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Totals Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 } as React.CSSProperties}>
            <div className="card" style={{ textAlign: 'center' } as React.CSSProperties}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties}>Suma</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' } as React.CSSProperties}>{formatCurrency(suma)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 } as React.CSSProperties}>Saldo Ant. + Ingresos</div>
            </div>
            <div className="card" style={{ textAlign: 'center' } as React.CSSProperties}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties}>Total Salidas</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' } as React.CSSProperties}>{formatCurrency(totalSalidas)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 } as React.CSSProperties}>Suma de egresos del día</div>
            </div>
            <div className="card" style={{ textAlign: 'center' } as React.CSSProperties}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties}>Saldo Actual</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af' } as React.CSSProperties}>{formatCurrency(saldoActualNum)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 } as React.CSSProperties}>Suma - Salidas</div>
            </div>
            <div className="card" style={{ textAlign: 'center', border: '2px solid #16a34a', background: '#f0fdf4' } as React.CSSProperties}>
              <div style={{ fontSize: 13, color: '#166534', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 } as React.CSSProperties}>
                <Banknote size={16} /> Caja del Día
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a' } as React.CSSProperties}>{formatCurrency(efectivoReal)}</div>
              <div style={{ fontSize: 11, color: '#166534', marginTop: 4, opacity: 0.7 } as React.CSSProperties}>
                Efectivo real en cajón (excluye TB)
              </div>
            </div>
          </div>
        </>
      )}

      <div className="print-only" style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#94a3b8' } as React.CSSProperties}>
        Reporte generado el {new Date().toLocaleDateString('es-AR')} a las {new Date().toLocaleTimeString('es-AR')}
      </div>
      </div>

      {/* Modal: Agregar Ingreso */}
      <Modal isOpen={showIngreso} onClose={() => setShowIngreso(false)} title="Agregar Ingreso" width="550px">
        <form onSubmit={handleAddIngreso}>
          {/* Order search */}
          <div className="form-group">
            <label>Vincular a Orden</label>
            <div style={{ position: 'relative' } as React.CSSProperties}>
              <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
                <input
                  className="input" placeholder="Buscar orden por número o cliente..."
                  value={ordenSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => searchOrdenes(e.target.value)}
                  style={{ flex: 1, paddingLeft: 36 } as React.CSSProperties}
                  onFocus={() => setShowOrdenSearch(true)}
                />
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' } as React.CSSProperties} />
                <button type="button" className="btn btn-outline" onClick={() => { setShowOrdenSearch(false); setOrdenSearch(''); setOrdenResults([]); }}>Limpiar</button>
              </div>
              {showOrdenSearch && ordenResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
                } as React.CSSProperties}>
                  {ordenResults.map((o: Record<string, unknown>) => (
                    <div key={o.id as number} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 14 } as React.CSSProperties}
                      onClick={() => selectOrden(o)}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.target as HTMLDivElement).style.background = '#f8fafc'; }}
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.target as HTMLDivElement).style.background = 'transparent'; }}>
                      <strong style={{ fontFamily: 'monospace' } as React.CSSProperties}>{(o.numero as string)}</strong> — {(o.cliente_nombre as string) || 'Sin cliente'}
                      <span style={{ cssFloat: 'right', color: '#64748b', fontSize: 12 } as React.CSSProperties}>{formatCurrency(o.total as number)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!!ingresoForm.orden_numero && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, marginBottom: 12, fontSize: 14, color: '#166534', border: '1px solid #bbf7d0' } as React.CSSProperties}>
              Orden seleccionada: <strong>{ingresoForm.orden_numero as string}</strong>
              {!!ingresoForm.cliente_nombre && ` — ${ingresoForm.cliente_nombre as string}`}
              {!!ingresoForm.orden_total && (
                <div style={{ marginTop: 6, fontSize: 13, color: '#475569' } as React.CSSProperties}>
                  Total original: <strong>{formatCurrency(ingresoForm.orden_total as number)}</strong>
                  {' | '}Saldo restante estimado:{' '}
                  <strong style={{ color: '#dc2626' } as React.CSSProperties}>
                    {formatCurrency(
                      Math.max(0, Number(ingresoForm.orden_total) - Number((ingresoForm.monto as string) || 0))
                    )}
                  </strong>
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Cliente</label>
              <input className="input" value={ingresoForm.cliente_nombre as string}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIngresoForm({ ...ingresoForm, cliente_nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Monto (Seña) *</label>
              <input className="input" type="number" step="0.01" min="0" required
                placeholder="Monto real que paga el cliente"
                value={ingresoForm.monto as string}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIngresoForm({ ...ingresoForm, monto: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Forma de Pago</label>
              <select className="input" value={ingresoForm.forma_pago as string}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIngresoForm({ ...ingresoForm, forma_pago: e.target.value })}>
                {FORMAS_PAGO.map((f: string) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Estado Carpeta</label>
              {ingresoForm.estado_carpeta ? (
                <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, fontSize: 14, color: '#475569', border: '1px solid #e2e8f0' } as React.CSSProperties}>
                  <span className={`badge ${estadoCarpetaClass(ingresoForm.estado_carpeta as string)}`} style={{ fontSize: 13 } as React.CSSProperties}>
                    {ingresoForm.estado_carpeta as string}
                  </span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' } as React.CSSProperties}>(asignado automático)</span>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#94a3b8', border: '1px solid #e2e8f0' } as React.CSSProperties}>
                  Sin orden vinculada
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 } as React.CSSProperties}>
            <button type="button" className="btn btn-outline" onClick={() => setShowIngreso(false)}>Cancelar</button>
            <button type="submit" className="btn btn-success">Registrar Ingreso</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Agregar Egreso */}
      <Modal isOpen={showEgreso} onClose={() => setShowEgreso(false)} title="Agregar Egreso" width="450px">
        <form onSubmit={handleAddEgreso}>
          <div className="form-group">
            <label>Concepto *</label>
            <input className="input" required placeholder="Ej: Nafta, Limpieza, Agua..."
              value={egresoForm.concepto as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEgresoForm({ ...egresoForm, concepto: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Monto *</label>
              <input className="input" type="number" step="0.01" min="0" required
                value={egresoForm.monto as string}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEgresoForm({ ...egresoForm, monto: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select className="input" value={egresoForm.tipo_egreso as string}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEgresoForm({ ...egresoForm, tipo_egreso: e.target.value })}>
                {TIPOS_EGRESO.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 } as React.CSSProperties}>
            <button type="button" className="btn btn-outline" onClick={() => setShowEgreso(false)}>Cancelar</button>
            <button type="submit" className="btn btn-danger">Registrar Egreso</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteMov}
        title="Eliminar movimiento"
        message="¿Estás seguro de eliminar este movimiento de caja?" />

      {/* Modal: Cerrar Caja */}
      <Modal isOpen={showCerrar} onClose={() => { setShowCerrar(false); setCerrarObs(''); }} title="Cerrar Caja del Día" width="450px">
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 16 } as React.CSSProperties}>
          Al cerrar la caja se congelarán los totales del día <strong>{fecha}</strong>.
          No se podrán agregar ni eliminar movimientos una vez cerrada.
        </p>
        <div className="form-group">
          <label>Observaciones / Notas de la jornada (opcional)</label>
          <textarea className="input" rows={4} style={{ resize: 'vertical' } as React.CSSProperties}
            placeholder="Ej: Cobros del día, incidencias, transferencias pendientes..."
            value={cerrarObs}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCerrarObs(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 } as React.CSSProperties}>
          <button type="button" className="btn btn-outline" onClick={() => { setShowCerrar(false); setCerrarObs(''); }}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={handleCerrarCaja}>
            <Lock size={14} style={{ marginRight: 4 } as React.CSSProperties} /> Cerrar Caja
          </button>
        </div>
      </Modal>
    </div>
  );
}
