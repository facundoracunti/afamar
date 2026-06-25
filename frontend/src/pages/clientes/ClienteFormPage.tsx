import React, { useState, useEffect } from 'react';
import type { Cliente } from '../../types/cliente';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ClipboardList, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { getCliente, createCliente, updateCliente } from '../../services/api';
import Loading from '../../components/common/Loading';
import { badgeClass } from '../../utils/formatters';

export default function ClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [historial, setHistorial] = useState<Record<string, unknown> | null>(null);
  const [cliente, setCliente] = useState({
    nombre: '', telefono: '', email: '', direccion: '', observaciones: '',
  });

  useEffect(() => {
    if (id) {
      getCliente(id).then((res) => {
        const d = res.data as Record<string, unknown>;
        setCliente({
          nombre: (d.nombre as string) || '',
          telefono: (d.telefono as string) || '',
          email: (d.email as string) || '',
          direccion: (d.direccion as string) || '',
          observaciones: (d.observaciones as string) || '',
        });
        setHistorial({
          total_presupuestos: (d.total_presupuestos as number) || 0,
          total_ordenes: (d.total_ordenes as number) || 0,
          total_comprado: (d.total_comprado as number) || 0,
          ultima_orden: d.ultima_orden as string | null,
          ordenes: (d.ordenes as Record<string, unknown>[]) || [],
          created_at: d.created_at as string,
        });
        setLoading(false);
      });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateCliente(id as string, cliente);
      } else {
        await createCliente(cliente);
      }
      navigate('/clientes');
    } catch (err: unknown) {
      const apiErr = err as Record<string, unknown>;
      const response = apiErr.response as Record<string, unknown> | undefined;
      const data = response?.data as Record<string, unknown> | undefined;
      alert((data?.detail as string) || 'Error al guardar cliente');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <form onSubmit={handleSubmit} style={{ flex: 1, minWidth: 400 }}>
          <div className="card">
            <h3 className="section-title">Datos del cliente</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Nombre *</label>
                <input className="input" required value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input className="input" value={cliente.telefono || ''} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input className="input" type="email" value={cliente.email || ''} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input className="input" value={cliente.direccion || ''} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Observaciones</label>
              <textarea className="input" rows={3} value={cliente.observaciones || ''} onChange={(e) => setCliente({ ...cliente, observaciones: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/clientes')}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Cliente')}
              </button>
            </div>
          </div>
        </form>

        {isEdit && historial && (
          <div style={{ flex: 1, minWidth: 350 }}>
            <div className="card">
              <h3 className="section-title">Historial del cliente</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                  <FileText size={20} style={{ color: '#3b82f6', marginBottom: 4 }} />
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{(historial.total_presupuestos as number)}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Presupuestos</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                  <ClipboardList size={20} style={{ color: '#059669', marginBottom: 4 }} />
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{(historial.total_ordenes as number)}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Órdenes</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                  <DollarSign size={20} style={{ color: '#d97706', marginBottom: 4 }} />
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>${(historial.total_comprado as number).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Total facturado</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                  <Calendar size={20} style={{ color: '#8b5cf6', marginBottom: 4 }} />
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{(historial.ultima_orden as string | null) || '-'}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Última orden</div>
                </div>
              </div>
            </div>

            {(historial.ordenes as Record<string, unknown>[]).length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 className="section-title">Órdenes asociadas</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(historial.ordenes as Record<string, unknown>[]).map((o: Record<string, unknown>) => (
                    <div
                      key={o.numero as string}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, cursor: 'pointer' }}
                      onClick={() => navigate(`/ordenes/${o.id as number}`)}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{o.numero as string}</span>
                        <span className={badgeClass(o.estado as string)} style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px' }}>{o.estado as string}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          ${Number((o.total as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <ArrowRight size={14} style={{ color: '#94a3b8' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}