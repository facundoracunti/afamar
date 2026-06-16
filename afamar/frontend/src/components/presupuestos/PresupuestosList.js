import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, FileDown, FileOutput, Eye, Send, Mail } from 'lucide-react';
import { getPresupuestosUnificados, deletePresupuesto, deletePresupuestoOnline, updatePresupuesto, convertirAOrden, convertirOnlineAOrden, getPresupuestoPdf, enviarPresupuestoWhatsApp, enviarPresupuestoEmail } from '../../services/api';
import { formatCurrency, formatDate, badgeClass } from '../../utils/formatters';
import ConfirmDialog from '../common/ConfirmDialog';
import Loading from '../common/Loading';

export default function PresupuestosList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState(searchParams.get('estado') || '');
  const [deleteId, setDeleteId] = useState(null);
  const [deleteTipo, setDeleteTipo] = useState(null);

  useEffect(() => {
    const e = searchParams.get('estado') || '';
    setEstado(e);
  }, [searchParams]);

  const load = () => {
    setLoading(true);
    getPresupuestosUnificados({ search: search || undefined, estado: estado || undefined }).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [search, estado]);

  const handleDelete = async () => {
    if (!deleteId) return;
    if (deleteTipo === 'online') await deletePresupuestoOnline(deleteId);
    else await deletePresupuesto(deleteId);
    setDeleteId(null);
    setDeleteTipo(null);
    load();
  };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    await updatePresupuesto(id, { estado: nuevoEstado });
    load();
  };

  const handleConvertirOnline = async (id) => {
    if (!window.confirm('¿Convertir este presupuesto online en Orden de Trabajo? Se copiarán todos los ítems.')) return;
    try {
      const res = await convertirOnlineAOrden(id);
      alert(`Orden ${res.data.numero} creada exitosamente.`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al convertir');
    }
  };

  const handleConvertir = async (id) => {
    if (!window.confirm('¿Convertir este presupuesto en Orden de Trabajo?\n\nSe copiará toda la información: material, croquis, firma, detalles de fabricación, pileta, precios y condiciones comerciales.')) return;
    try {
      const res = await convertirAOrden(id);
      alert(`Orden ${res.data.numero} creada exitosamente.`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al convertir');
    }
  };

  const handleEnviarWhatsApp = async (id) => {
    try {
      await enviarPresupuestoWhatsApp(id);
      alert('WhatsApp enviado correctamente');
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar WhatsApp');
    }
  };

  const handleEnviarEmail = async (id) => {
    try {
      await enviarPresupuestoEmail(id);
      alert('Email enviado correctamente');
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar email');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>PRESUPUESTOS LOCAL</h1>
        <button className="btn btn-primary" onClick={() => navigate('/presupuestos/nuevo')}>
          <Plus size={16} /> Nuevo Presupuesto Local
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="input" placeholder="Buscar por N° / Cliente / Teléfono / Material..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
          </div>
          <select className="input" style={{ width: 240 }} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">PRESUPUESTOS</option>
            <option value="CONVERTIDO A OT">PRESUPUESTOS REALIZADOS</option>
          </select>
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Material</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th style={{ width: 240 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.tipo + '-' + p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(p.tipo === 'online' ? `/presupuestos-online/${p.id}` : `/presupuestos/${p.id}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {p.numero}
                      {p.orden_trabajo_numero && (
                        <div style={{ fontSize: 10, color: '#059669', fontFamily: 'monospace' }}>
                          → {p.orden_trabajo_numero}
                        </div>
                      )}
                    </td>
                    <td>{formatDate(p.fecha) || '-'}</td>
                    <td>{p.cliente_nombre || '-'}</td>
                    <td>{p.cliente_telefono || '-'}</td>
                    <td>{p.material || (p.tipo === 'online' ? 'Online' : '-')}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(p.total)}</td>
                    <td>
                      <span className={badgeClass(p.estado)}>{p.estado}</span>
                      {p.tipo === 'online' && <span className="badge badge-production" style={{ marginLeft: 4, fontSize: 10 }}>ONLINE</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => navigate(p.tipo === 'online' ? `/presupuestos-online/${p.id}` : `/presupuestos/${p.id}`)}>
                            <Eye size={12} /> Ver
                          </button>
                          {p.tipo !== 'online' && p.estado === 'PENDIENTE' && (
                            <button className="btn btn-success" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleCambiarEstado(p.id, 'APROBADO')}>
                              Aprobar
                            </button>
                          )}
                          {p.tipo !== 'online' && p.estado === 'APROBADO' && (
                            <button className="btn" style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => handleConvertir(p.id)}>
                              <FileOutput size={11} /> Convertir a OT
                            </button>
                          )}
                          {p.tipo === 'online' && (
                            <button className="btn" style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => handleConvertirOnline(p.id)}>
                              <FileOutput size={11} /> Convertir a OT
                            </button>
                          )}
                          {p.tipo !== 'online' && p.estado === 'CONVERTIDO A OT' && p.orden_trabajo_numero && (
                            <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11, color: '#059669', borderColor: '#059669' }} onClick={() => navigate(`/ordenes?search=${p.orden_trabajo_numero}`)}>
                              OT {p.orden_trabajo_numero}
                            </button>
                          )}
                          {p.tipo !== 'online' && ['PENDIENTE', 'APROBADO'].includes(p.estado) && (
                            <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleCambiarEstado(p.id, 'RECHAZADO')}>
                              Rechazar
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => window.open(getPresupuestoPdf(p.id), '_blank')}>
                            <FileDown size={12} /> PDF
                          </button>
                          <button className="btn btn-success" style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleEnviarWhatsApp(p.id)}>
                            <Send size={12} /> WhatsApp
                          </button>
                          <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleEnviarEmail(p.id)}>
                            <Mail size={12} /> Email
                          </button>
                          <button className="btn btn-danger" style={{ padding: '3px 6px' }} onClick={() => { setDeleteId(p.id); setDeleteTipo(p.tipo); }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No hay presupuestos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar presupuesto" message="¿Estás seguro?" />
    </div>
  );
}
