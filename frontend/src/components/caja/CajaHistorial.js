import React, { useState, useEffect } from 'react';
import { getCajaHistorial } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { ArrowUpCircle, ArrowDownCircle, Calendar, FileText } from 'lucide-react';
import Loading from '../common/Loading';

export default function CajaHistorial() {
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getCajaHistorial();
        setCajas(res.data || []);
      } catch {
        setCajas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Historial de Cierres de Caja</h1>

      {cajas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <Calendar size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>No hay cajas cerradas aún.</p>
          <p style={{ fontSize: 13 }}>Cerrá un día desde Caja Diaria para que aparezca aquí.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
          {/* Lista cronológica */}
          <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Saldo Anterior</th>
                      <th>Total Ingresos</th>
                      <th>Total Salidas</th>
                      <th>Saldo Actual</th>
                      <th>Efectivo Real</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cajas.map((c) => (
                      <tr key={c.id}
                        onClick={() => setSelected(selected?.id === c.id ? null : c)}
                        style={{ cursor: 'pointer', background: selected?.id === c.id ? '#f0fdf4' : undefined }}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.fecha}</td>
                        <td>{formatCurrency(c.saldo_anterior)}</td>
                        <td style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(c.total_ingresos)}</td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(c.total_salidas)}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(c.saldo_actual)}</td>
                        <td style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(c.efectivo_real)}</td>
                        <td>
                          <button className="btn" style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setSelected(selected?.id === c.id ? null : c); }}>
                            <FileText size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detalle de la caja seleccionada */}
          {selected && (
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Detalle — {selected.fecha}</h3>
                {selected.observaciones && (
                  <div style={{ padding: '10px 14px', background: '#fefce8', borderRadius: 8, marginBottom: 12, fontSize: 13, border: '1px solid #fde68a' }}>
                    <strong>Observaciones:</strong> {selected.observaciones}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Saldo Anterior:</span>{' '}
                    <strong>{formatCurrency(selected.saldo_anterior)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Saldo Actual:</span>{' '}
                    <strong>{formatCurrency(selected.saldo_actual)}</strong>
                  </div>
                  <div style={{ color: '#16a34a' }}>
                    <ArrowUpCircle size={14} style={{ marginRight: 4 }} />
                    Ingresos: <strong>{formatCurrency(selected.total_ingresos)}</strong>
                  </div>
                  <div style={{ color: '#dc2626' }}>
                    <ArrowDownCircle size={14} style={{ marginRight: 4 }} />
                    Egresos: <strong>{formatCurrency(selected.total_salidas)}</strong>
                  </div>
                  <div style={{ color: '#16a34a', fontWeight: 700, gridColumn: '1 / -1' }}>
                    Efectivo Real: {formatCurrency(selected.efectivo_real)}
                  </div>
                </div>
              </div>

              {/* Movimientos del día seleccionado */}
              {selected.movimientos && selected.movimientos.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, padding: '12px 16px 0' }}>Movimientos</h3>
                  <div className="table-container" style={{ marginTop: 8 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Concepto</th>
                          <th>Monto</th>
                          <th>Pago</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.movimientos.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <span className={`badge ${m.tipo === 'INGRESO' ? 'badge-approved' : 'badge-rejected'}`}>
                                {m.tipo === 'INGRESO' ? 'Entrada' : 'Salida'}
                              </span>
                            </td>
                            <td>{m.concepto || '-'}</td>
                            <td style={{ fontWeight: 600, color: m.tipo === 'INGRESO' ? '#16a34a' : '#dc2626' }}>
                              {formatCurrency(m.monto)}
                            </td>
                            <td>{m.forma_pago || m.tipo_egreso || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
