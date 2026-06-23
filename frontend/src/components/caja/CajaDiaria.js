import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Search, ArrowUpCircle, ArrowDownCircle, Wallet, Banknote, Printer, Lock } from 'lucide-react';
import { getCajaDiaria, createMovimientoCaja, deleteMovimientoCaja, putSaldoAnterior, getOrdenes, cerrarCaja } from '../../services/api';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import Loading from '../common/Loading';
import { formatCurrency } from '../../utils/formatters';

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta'];
const TIPOS_EGRESO = ['Gasto', 'Transferencia Banco'];

const ESTADO_CARPETA_MAP = {
  'MEDICION': 'Medición',
  'TALLER': 'Taller',
  'TERMINADA': 'Terminada',
  'ENTREGADA': 'Entregada',
};

const estadoCarpetaClass = (estado) => {
  const map = {
    'Medición': 'badge-pending',
    'Taller': 'badge-production',
    'Terminada': 'badge-finished',
    'Entregada': 'badge-finished',
  };
  return map[estado] || 'badge-pending';
};

export default function CajaDiaria() {
  const today = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState(today);
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saldoAnteriorEdit, setSaldoAnteriorEdit] = useState(false);

  const [showIngreso, setShowIngreso] = useState(false);
  const [showEgreso, setShowEgreso] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [ingresoForm, setIngresoForm] = useState({
    monto: '', forma_pago: 'Efectivo', estado_carpeta: 'Medición',
    orden_numero: '', cliente_nombre: '', orden_id: null, orden_total: null,
  });
  const [egresoForm, setEgresoForm] = useState({
    concepto: '', monto: '', tipo_egreso: 'Gasto',
  });

  const [showCerrar, setShowCerrar] = useState(false);
  const [cerrarObs, setCerrarObs] = useState('');
  const [cerrada, setCerrada] = useState(false);

  const [ordenSearch, setOrdenSearch] = useState('');
  const [ordenResults, setOrdenResults] = useState([]);
  const [showOrdenSearch, setShowOrdenSearch] = useState(false);

  const loadCaja = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCajaDiaria(fecha);
      if (res.data) {
        const movs = res.data.movimientos || [];
        setSaldoAnterior(prev => res.data.saldo_anterior ?? prev);
        setMovimientos(movs);
        setCerrada(res.data.cerrada || false);

        // Si es caja nueva (saldo_anterior=0, vacía, sin cerrar), arrastra saldo del día anterior
        if (!res.data.cerrada && movs.length === 0 && !res.data.saldo_anterior) {
          const prev = new Date(fecha);
          prev.setDate(prev.getDate() - 1);
          const prevStr = prev.toISOString().split('T')[0];
          try {
            const prevRes = await getCajaDiaria(prevStr);
            const prevSaldo = prevRes.data?.saldo_actual || 0;
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
    } catch (err) {
      alert('Error al guardar saldo anterior');
    }
  };

  const searchOrdenes = async (q) => {
    setOrdenSearch(q);
    if (q.length < 2) { setOrdenResults([]); return; }
    try {
      const res = await getOrdenes({ search: q, limit: 10 });
      setOrdenResults(res.data || []);
    } catch { setOrdenResults([]); }
  };

  const selectOrden = (orden) => {
    setIngresoForm({
      ...ingresoForm,
      orden_id: orden.id,
      orden_numero: orden.numero,
      cliente_nombre: orden.cliente_nombre || '',
      monto: orden.total || '',
      estado_carpeta: ESTADO_CARPETA_MAP[orden.estado] || orden.estado || '',
      orden_total: orden.total || null,
    });
    setShowOrdenSearch(false);
    setOrdenSearch('');
    setOrdenResults([]);
  };

  const handleAddIngreso = async (e) => {
    e.preventDefault();
    if (!ingresoForm.monto || Number(ingresoForm.monto) <= 0) return;
    try {
      await createMovimientoCaja({
        fecha,
        tipo: 'INGRESO',
        monto: Number(ingresoForm.monto),
        concepto: ingresoForm.orden_numero
          ? `Pago ${ingresoForm.orden_numero} - ${ingresoForm.cliente_nombre}`
          : `Ingreso manual - ${ingresoForm.cliente_nombre || ''}`,
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
    } catch (err) {
      alert('Error al registrar ingreso');
    }
  };

  const handleAddEgreso = async (e) => {
    e.preventDefault();
    if (!egresoForm.monto || Number(egresoForm.monto) <= 0) return;
    try {
      await createMovimientoCaja({
        fecha,
        tipo: 'EGRESO',
        monto: Number(egresoForm.monto),
        concepto: egresoForm.concepto,
        tipo_egreso: egresoForm.tipo_egreso,
      });
      setShowEgreso(false);
      setEgresoForm({ concepto: '', monto: '', tipo_egreso: 'Gasto' });
      await loadCaja();
    } catch (err) {
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
      await cerrarCaja(fecha, cerrarObs || null);
      setShowCerrar(false);
      setCerrarObs('');
      await loadCaja();
    } catch {
      alert('Error al cerrar la caja');
    }
  };

  const handlePrint = () => window.print();

  const ingresos = movimientos.filter(m => m.tipo === 'INGRESO');
  const egresos = movimientos.filter(m => m.tipo === 'EGRESO');

  const totalIngresos = ingresos.reduce((s, m) => s + (m.monto || 0), 0);
  const totalSalidas = egresos.reduce((s, m) => s + (m.monto || 0), 0);
  const suma = (saldoAnterior || 0) + totalIngresos;
  const saldoActualNum = suma - totalSalidas;

  const ingresosEfectivo = ingresos
    .filter(m => m.forma_pago === 'Efectivo')
    .reduce((s, m) => s + (m.monto || 0), 0);
  const totalTB = egresos
    .filter(m => m.tipo_egreso === 'Transferencia Banco')
    .reduce((s, m) => s + (m.monto || 0), 0);
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
        <div className="print-only" style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>CIERRE DE CAJA</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>Fecha: {fecha}</p>
          <hr style={{ margin: '10px 0', border: 'none', borderTop: '2px solid #000' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 className="no-print" style={{ fontSize: 24, fontWeight: 700 }}>Caja Diaria</h1>
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              className="input"
              style={{ width: 180 }}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            {!isToday && (
              <button className="btn btn-outline" onClick={() => setFecha(today)}>Hoy</button>
            )}
            {isToday && !cerrada && (
              <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={() => setShowCerrar(true)}>
                <Lock size={14} style={{ marginRight: 4 }} /> Cerrar Caja del Día
              </button>
            )}
            {cerrada && (
              <span className="badge badge-finished" style={{ fontSize: 13 }}>Cerrada</span>
            )}
            <button className="btn btn-outline no-print-keep" style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={handlePrint}>
              <Printer size={14} style={{ marginRight: 4 }} /> Imprimir Reporte
            </button>
          </div>
        </div>

        {/* Saldo Anterior */}
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Wallet size={22} style={{ color: '#64748b' }} />
        <span style={{ fontWeight: 600, fontSize: 15, color: '#475569' }}>Saldo Anterior:</span>
        {saldoAnteriorEdit ? (
          <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              type="number"
              step="0.01"
              style={{ width: 160 }}
              value={saldoAnterior}
              onChange={(e) => setSaldoAnterior(Number(e.target.value))}
              autoFocus
            />
            <button className="btn btn-primary" style={{ padding: '6px 14px' }} onClick={handleSaveSaldoAnterior}>Guardar</button>
            <button className="btn btn-outline" style={{ padding: '6px 14px' }} onClick={() => { setSaldoAnteriorEdit(false); loadCaja(); }}>Cancelar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#1e293b' }}>{formatCurrency(saldoAnterior)}</span>
            {!cerrada && (
              <button className="btn btn-outline no-print" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSaldoAnteriorEdit(true)}>Editar</button>
            )}
          </div>
        )}
      </div>

      {loading ? <Loading /> : (
        <>
          {/* Two-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Left: Ingresos */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a' }}>
                  <ArrowUpCircle size={20} /> Entradas (Ingresos)
                </h3>
                <button className="btn btn-success no-print" style={{ padding: '6px 12px', fontSize: 13 }}
                  disabled={cerrada} onClick={() => setShowIngreso(true)}>
                  <Plus size={14} /> Agregar Ingreso
                </button>
              </div>
              <div className="table-container" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>N° Orden</th>
                      <th>Cliente</th>
                      <th style={{ width: 110 }}>Monto</th>
                      <th style={{ width: 110 }}>Saldo Restante</th>
                      <th style={{ width: 100 }}>Pago</th>
                      <th style={{ width: 90 }}>Carpeta</th>
                      <th className="no-print" style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingresos.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Sin ingresos registrados</td></tr>
                    ) : (
                      ingresos.map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.orden_numero || '-'}</td>
                          <td>{m.cliente_nombre || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#16a34a' }}>{formatCurrency(m.monto)}</td>
                          <td style={{ fontWeight: 600, color: m.saldo_restante > 0 ? '#dc2626' : '#94a3b8' }}>
                            {m.saldo_restante !== null && m.saldo_restante !== undefined ? formatCurrency(m.saldo_restante) : '-'}
                          </td>
                          <td>
                            <span className={`badge ${m.forma_pago === 'Efectivo' ? 'badge-approved' : m.forma_pago === 'Transferencia' ? 'badge-production' : 'badge-pending'}`}>
                              {m.forma_pago || '-'}
                            </span>
                          </td>
                          <td>
                            {m.estado_carpeta ? (
                              <span className={`badge ${estadoCarpetaClass(m.estado_carpeta)}`}>{m.estado_carpeta}</span>
                            ) : '-'}
                          </td>
                          <td className="no-print">
                            <button className="btn" style={{ padding: '3px 6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => setDeleteId(m.id)} title="Eliminar">
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
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
                  <ArrowDownCircle size={20} /> Salidas (Egresos)
                </h3>
                <button className="btn btn-danger no-print" style={{ padding: '6px 12px', fontSize: 13 }}
                  disabled={cerrada} onClick={() => setShowEgreso(true)}>
                  <Plus size={14} /> Agregar Egreso
                </button>
              </div>
              <div className="table-container" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                        <tr>
                          <th>Concepto</th>
                          <th style={{ width: 110 }}>Monto</th>
                          <th style={{ width: 90 }}>Tipo</th>
                          <th className="no-print" style={{ width: 40 }}></th>
                        </tr>
                  </thead>
                  <tbody>
                    {egresos.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Sin egresos registrados</td></tr>
                    ) : (
                      egresos.map((m) => (
                        <tr key={m.id}>
                          <td>{m.concepto || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#dc2626' }}>{formatCurrency(m.monto)}</td>
                          <td>
                            <span className={`badge ${m.tipo_egreso === 'Gasto' ? 'badge-rejected' : 'badge-production'}`}>
                              {m.tipo_egreso || 'Gasto'}
                            </span>
                          </td>
                          <td className="no-print">
                            <button className="btn" style={{ padding: '3px 6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => setDeleteId(m.id)} title="Eliminar">
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suma</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{formatCurrency(suma)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Saldo Ant. + Ingresos</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Salidas</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(totalSalidas)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Suma de egresos del día</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo Actual</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af' }}>{formatCurrency(saldoActualNum)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Suma - Salidas</div>
            </div>
            <div className="card" style={{ textAlign: 'center', border: '2px solid #16a34a', background: '#f0fdf4' }}>
              <div style={{ fontSize: 13, color: '#166534', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Banknote size={16} /> Caja del Día
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a' }}>{formatCurrency(efectivoReal)}</div>
              <div style={{ fontSize: 11, color: '#166534', marginTop: 4, opacity: 0.7 }}>
                Efectivo real en cajón (excluye TB)
              </div>
            </div>
          </div>
        </>
      )}

      <div className="print-only" style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#94a3b8' }}>
        Reporte generado el {new Date().toLocaleDateString('es-AR')} a las {new Date().toLocaleTimeString('es-AR')}
      </div>
      </div>

      {/* Modal: Agregar Ingreso */}
      <Modal isOpen={showIngreso} onClose={() => setShowIngreso(false)} title="Agregar Ingreso" width="550px">
        <form onSubmit={handleAddIngreso}>
          {/* Order search */}
          <div className="form-group">
            <label>Vincular a Orden</label>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input" placeholder="Buscar orden por número o cliente..."
                  value={ordenSearch}
                  onChange={(e) => searchOrdenes(e.target.value)}
                  style={{ flex: 1, paddingLeft: 36 }}
                  onFocus={() => setShowOrdenSearch(true)}
                />
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <button type="button" className="btn btn-outline" onClick={() => { setShowOrdenSearch(false); setOrdenSearch(''); setOrdenResults([]); }}>Limpiar</button>
              </div>
              {showOrdenSearch && ordenResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
                }}>
                  {ordenResults.map(o => (
                    <div key={o.id} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}
                      onClick={() => selectOrden(o)}
                      onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                      <strong style={{ fontFamily: 'monospace' }}>{o.numero}</strong> — {o.cliente_nombre || 'Sin cliente'}
                      <span style={{ float: 'right', color: '#64748b', fontSize: 12 }}>{formatCurrency(o.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {ingresoForm.orden_numero && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, marginBottom: 12, fontSize: 14, color: '#166534', border: '1px solid #bbf7d0' }}>
              Orden seleccionada: <strong>{ingresoForm.orden_numero}</strong>
              {ingresoForm.cliente_nombre && ` — ${ingresoForm.cliente_nombre}`}
              {ingresoForm.orden_total && (
                <div style={{ marginTop: 6, fontSize: 13, color: '#475569' }}>
                  Total original: <strong>{formatCurrency(ingresoForm.orden_total)}</strong>
                  {' | '}Saldo restante estimado:{' '}
                  <strong style={{ color: '#dc2626' }}>
                    {formatCurrency(
                      Math.max(0, Number(ingresoForm.orden_total) - Number(ingresoForm.monto || 0))
                    )}
                  </strong>
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Cliente</label>
              <input className="input" value={ingresoForm.cliente_nombre}
                onChange={(e) => setIngresoForm({ ...ingresoForm, cliente_nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Monto (Seña) *</label>
              <input className="input" type="number" step="0.01" min="0" required
                placeholder="Monto real que paga el cliente"
                value={ingresoForm.monto}
                onChange={(e) => setIngresoForm({ ...ingresoForm, monto: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Forma de Pago</label>
              <select className="input" value={ingresoForm.forma_pago}
                onChange={(e) => setIngresoForm({ ...ingresoForm, forma_pago: e.target.value })}>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Estado Carpeta</label>
              {ingresoForm.estado_carpeta ? (
                <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, fontSize: 14, color: '#475569', border: '1px solid #e2e8f0' }}>
                  <span className={`badge ${estadoCarpetaClass(ingresoForm.estado_carpeta)}`} style={{ fontSize: 13 }}>
                    {ingresoForm.estado_carpeta}
                  </span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' }}>(asignado automático)</span>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                  Sin orden vinculada
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
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
              value={egresoForm.concepto}
              onChange={(e) => setEgresoForm({ ...egresoForm, concepto: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Monto *</label>
              <input className="input" type="number" step="0.01" min="0" required
                value={egresoForm.monto}
                onChange={(e) => setEgresoForm({ ...egresoForm, monto: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select className="input" value={egresoForm.tipo_egreso}
                onChange={(e) => setEgresoForm({ ...egresoForm, tipo_egreso: e.target.value })}>
                {TIPOS_EGRESO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
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
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>
          Al cerrar la caja se congelarán los totales del día <strong>{fecha}</strong>.
          No se podrán agregar ni eliminar movimientos una vez cerrada.
        </p>
        <div className="form-group">
          <label>Observaciones / Notas de la jornada (opcional)</label>
          <textarea className="input" rows={4} style={{ resize: 'vertical' }}
            placeholder="Ej: Cobros del día, incidencias, transferencias pendientes..."
            value={cerrarObs}
            onChange={(e) => setCerrarObs(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-outline" onClick={() => { setShowCerrar(false); setCerrarObs(''); }}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={handleCerrarCaja}>
            <Lock size={14} style={{ marginRight: 4 }} /> Cerrar Caja
          </button>
        </div>
      </Modal>
    </div>
  );
}
