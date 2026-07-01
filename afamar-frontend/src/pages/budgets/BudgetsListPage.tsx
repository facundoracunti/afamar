import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, FileDown, FileOutput, Eye, Send, Mail } from 'lucide-react';
import { getPresupuestosUnificados, deletePresupuesto, deletePresupuestoOnline, updatePresupuesto, convertirAOrden, convertirOnlineAOrden, getPresupuestoPdf, enviarPresupuestoEmail } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import type { PresupuestoUnificado } from '../../types/presupuesto';

export default function PresupuestosList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PresupuestoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState(searchParams.get('estado') || '');
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  const [deleteTipo, setDeleteTipo] = useState<string | null>(null);

  useEffect(() => {
    const e = searchParams.get('estado') || 'PENDIENTE';
    setEstado(e);
  }, [searchParams]);

  const load = () => {
    setLoading(true);
    getPresupuestosUnificados({ search: search || undefined, estado: estado || undefined }).then((res) => {
      setData(res.data as PresupuestoUnificado[]);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [search, estado]);

  const handleDelete = async () => {
    if (!deleteId) return;
    if (deleteTipo === 'online') await deletePresupuestoOnline(deleteId as string);
    else await deletePresupuesto(deleteId as string);
    setDeleteId(null);
    setDeleteTipo(null);
    load();
  };

  const handleCambiarEstado = async (id: string | number, nuevoEstado: string) => {
    await updatePresupuesto(id as string, { estado: nuevoEstado } as Record<string, unknown>);
    load();
  };

  const handleConvertirOnline = async (id: string | number) => {
    if (!window.confirm('¿Convertir este presupuesto online en Orden de Trabajo? Se copiarán todos los ítems.')) return;
    try {
      const res = await convertirOnlineAOrden(id as string);
      navigate(`/admin/ordenes/${(res.data as Record<string, unknown>).orden_id as string}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Error al convertir');
    }
  };

  const handleConvertir = async (id: string | number) => {
    if (!window.confirm('¿Convertir este presupuesto en Orden de Trabajo?\n\nSe copiará toda la información: material, croquis, firma, detalles de fabricación, pileta, precios y condiciones comerciales.')) return;
    try {
      const res = await convertirAOrden(id as string);
      navigate(`/admin/ordenes/${(res.data as Record<string, unknown>).orden_id as string}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Error al convertir');
    }
  };

  const handleEnviarWhatsApp = (presupuesto: PresupuestoUnificado) => {
    const telefono = (presupuesto.cliente_telefono || '').replace(/[^\d]/g, '');
    const nombre = presupuesto.cliente_nombre || '';
    const pdfUrl = getPresupuestoPdf(presupuesto.id as unknown as string);
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te enviamos el presupuesto formal de AFAMAR Mármoles & Granitos. Podés revisarlo e imprimirlo desde el siguiente link: ${pdfUrl}`;
    const whatsappUrl = telefono
      ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEnviarEmail = async (id: string | number) => {
    try {
      await enviarPresupuestoEmail(id as string);
      alert('Email enviado correctamente');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Error al enviar email');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } as React.CSSProperties}>
        <h1 style={{ fontSize: 24, fontWeight: 700 } as React.CSSProperties}>PRESUPUESTOS LOCAL / WHATSAPP</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/presupuestos/nuevo')}>
          <Plus size={16} /> Nuevo Presupuesto Local
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 } as React.CSSProperties}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' } as React.CSSProperties}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 } as React.CSSProperties}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' } as React.CSSProperties} />
            <input className="input" placeholder="Buscar por N° / Cliente / Teléfono / Material..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ paddingLeft: 40 } as React.CSSProperties} />
          </div>
          <select className="input" style={{ width: 240 } as React.CSSProperties} value={estado} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstado(e.target.value)}>
            <option value="PENDIENTE">PRESUPUESTO LOCAL / WHATSAPP</option>
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
                  <th style={{ width: 90 } as React.CSSProperties}>Número</th>
                  <th style={{ width: 95, fontSize: 12 } as React.CSSProperties}>Fecha</th>
                  <th style={{ width: 160 } as React.CSSProperties}>Cliente</th>
                  <th style={{ width: 110 } as React.CSSProperties}>Teléfono</th>
                  <th style={{ width: 130 } as React.CSSProperties}>Material</th>
                  <th>Detalles</th>
                  <th style={{ width: 110 } as React.CSSProperties}>Total</th>
                  <th style={{ width: 100 } as React.CSSProperties}>Estado</th>
                  <th style={{ width: 160 } as React.CSSProperties}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p: PresupuestoUnificado) => (
                  <tr key={p.tipo + '-' + p.id} style={{ cursor: 'pointer' } as React.CSSProperties} onClick={() => navigate(p.tipo === 'online' ? `/admin/presupuestos-online/${p.id}` : `/admin/presupuestos/${p.id}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' } as React.CSSProperties}>
                      {p.numero}
                      {p.orden_trabajo_numero && (
                        <div style={{ fontSize: 10, color: '#059669', fontFamily: 'monospace' } as React.CSSProperties}>
                          → {p.orden_trabajo_numero}
                        </div>
                      )}
                    </td>
                    <td>{formatDate((p.fecha || '').split('T')[0]) || '-'}</td>
                    <td>{p.cliente_nombre || '-'}</td>
                    <td>{p.cliente_telefono || '-'}</td>
                    <td style={{ fontWeight: 500, textTransform: 'uppercase' } as React.CSSProperties}>
                      {(() => {
                        if (p.materiales && p.materiales.length > 0) return [...new Set(p.materiales.map((m: { nombre: string }) => m.nombre.trim()))].join(' - ');
                        if (p.tipo === 'online' && p.items?.length) {
                          const mats = p.items.filter((i: { detalle: string }) => i.detalle && i.detalle !== 'LONGITUD' && !['ZOCALOS', 'APERTURA + PEGADO PILETA', 'APERTURA PILETA APOYO', 'MENSULAS', 'APERTURA ANAFE', 'TERMINACION', 'PILETA MOD'].includes(i.detalle)).map((i: { detalle: string }) => i.detalle.trim());
                          const zocMat = p.items.filter((i: { material?: string }) => i.material).map((i: { material?: string }) => (i.material || '').trim());
                          const all = [...new Set([...mats, ...zocMat])];
                          return all.length ? all.join(' - ') : 'Online';
                        }
                        return p.material || '-';
                      })()}
                    </td>
                    <td style={{ color: '#2d3748', fontSize: 13, lineHeight: 1.4, whiteSpace: 'normal', wordBreak: 'break-word' } as React.CSSProperties}
                      title={p.observaciones_diseno || ''}>
                      {(() => {
                        const txt = p.observaciones_diseno || '';
                        return txt.length > 60 ? txt.slice(0, 60) + '...' : (txt || '-');
                      })()}
                    </td>
                    <td style={{ fontWeight: 600 } as React.CSSProperties}><CurrencyDisplay value={p.total} style={{ fontWeight: 600 }} /></td>
                    <td>
                      {p.estado === 'CONVERTIDO A OT' ? (
                        <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: 50, fontSize: 12, fontWeight: 700, display: 'inline-block' } as React.CSSProperties}>CONCRETADO</span>
                      ) : p.tipo === 'online' ? (
                        <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: 50, fontSize: 12, fontWeight: 700, display: 'inline-block', border: '1px solid #f59e0b' } as React.CSSProperties}>PENDIENTE - ONLINE</span>
                      ) : (
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 12px', borderRadius: 50, fontSize: 12, fontWeight: 700, display: 'inline-block' } as React.CSSProperties}>PENDIENTE</span>
                      )}
                    </td>
                    <td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 } as React.CSSProperties}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' } as React.CSSProperties}>
                          <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11 } as React.CSSProperties} onClick={() => navigate(p.tipo === 'online' ? `/admin/presupuestos-online/${p.id}` : `/admin/presupuestos/${p.id}`)}>
                            <Eye size={12} /> Ver
                          </button>
                          {p.tipo !== 'online' && p.estado === 'PENDIENTE' && (
                            <button className="btn btn-success" style={{ padding: '3px 8px', fontSize: 11 } as React.CSSProperties} onClick={() => handleCambiarEstado(p.id, 'APROBADO')}>
                              Aprobar
                            </button>
                          )}
                          {p.tipo !== 'online' && p.estado === 'APROBADO' && (
                            <button className="btn" style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' } as React.CSSProperties} onClick={() => handleConvertir(p.id)}>
                              <FileOutput size={11} /> Convertir a OT
                            </button>
                          )}
                          {p.tipo === 'online' && (
                            <button className="btn" style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' } as React.CSSProperties} onClick={() => handleConvertirOnline(p.id)}>
                              <FileOutput size={11} /> Convertir a OT
                            </button>
                          )}
                          {p.tipo !== 'online' && p.estado === 'CONVERTIDO A OT' && p.orden_trabajo_numero && (
                            <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11, color: '#059669', borderColor: '#059669' } as React.CSSProperties} onClick={() => navigate(`/admin/ordenes?search=${p.orden_trabajo_numero}`)}>
                              OT {p.orden_trabajo_numero}
                            </button>
                          )}
                          {p.tipo !== 'online' && ['PENDIENTE', 'APROBADO'].includes(p.estado) && (
                            <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: 11 } as React.CSSProperties} onClick={() => handleCambiarEstado(p.id, 'RECHAZADO')}>
                              Rechazar
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 } as React.CSSProperties}>
                          <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties} onClick={() => window.open(getPresupuestoPdf(p.id as unknown as string), '_blank')}>
                            <FileDown size={12} /> PDF
                          </button>
                          <button className="btn btn-success" style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties} onClick={() => handleEnviarWhatsApp(p)}>
                            <Send size={12} /> WhatsApp
                          </button>
                          <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties} onClick={() => handleEnviarEmail(p.id)}>
                            <Mail size={12} /> Email
                          </button>
                          <button className="btn btn-danger" style={{ padding: '3px 6px' } as React.CSSProperties} onClick={() => { setDeleteId(p.id); setDeleteTipo(p.tipo); }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' } as React.CSSProperties}>No hay presupuestos</td></tr>
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
