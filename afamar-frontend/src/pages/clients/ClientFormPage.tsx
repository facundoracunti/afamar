import React, { useState, useEffect } from 'react';
import type { Cliente } from '../../types/cliente';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ClipboardList, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { getClient, createClient, updateClient } from '@/api/resources/clients';
import Loading from '../../components/common/Loading';
import EstadoBadge from '../../components/ui/EstadoBadge';
import styles from './ClientFormPage.module.css';

const s = styles as unknown as Record<string, string>;

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
      getClient(id).then((res) => {
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
        await updateClient(id as string, cliente);
      } else {
        await createClient(cliente);
      }
      navigate('/admin/clients');
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

  const formatCurrency = (n: number): string =>
    `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className={s['client-form']}>
      <h1 className={s['client-form__title']}>
        {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
      </h1>

      <div className={s['client-form__layout']}>
        <form onSubmit={handleSubmit} className={s['client-form__main']}>
          <div className={s['client-form__card']}>
            <h3 className={s['client-form__section']}>Datos del cliente</h3>
            <div className={s['client-form__row']}>
              <div className={s['client-form__group']}>
                <label className={s['client-form__label']}>Nombre *</label>
                <input className="input" required value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} />
              </div>
              <div className={s['client-form__group']}>
                <label className={s['client-form__label']}>Teléfono</label>
                <input className="input" value={cliente.telefono || ''} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
              </div>
            </div>
            <div className={s['client-form__row']}>
              <div className={s['client-form__group']}>
                <label className={s['client-form__label']}>Email</label>
                <input className="input" type="email" value={cliente.email || ''} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
              </div>
              <div className={s['client-form__group']}>
                <label className={s['client-form__label']}>Dirección</label>
                <input className="input" value={cliente.direccion || ''} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} />
              </div>
            </div>
            <div className={s['client-form__group']}>
              <label className={s['client-form__label']}>Observaciones</label>
              <textarea className="input" rows={3} value={cliente.observaciones || ''} onChange={(e) => setCliente({ ...cliente, observaciones: e.target.value })} />
            </div>

            <div className={s['client-form__actions']}>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/clients')}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Cliente')}
              </button>
            </div>
          </div>
        </form>

        {isEdit && historial && (
          <div className={s['client-form__side']}>
            <div className={s['client-form__card']}>
              <h3 className={s['client-form__section']}>Historial del cliente</h3>
              <div className={s['client-form__stats']}>
                <div className={s['client-form__stat']}>
                  <FileText size={20} color="#3b82f6" className={s['client-form__stat-icon']} />
                  <div className={s['client-form__stat-value']}>{(historial.total_presupuestos as number)}</div>
                  <div className={s['client-form__stat-label']}>Presupuestos</div>
                </div>
                <div className={s['client-form__stat']}>
                  <ClipboardList size={20} color="#059669" className={s['client-form__stat-icon']} />
                  <div className={s['client-form__stat-value']}>{(historial.total_ordenes as number)}</div>
                  <div className={s['client-form__stat-label']}>Órdenes</div>
                </div>
                <div className={s['client-form__stat']}>
                  <DollarSign size={20} color="#d97706" className={s['client-form__stat-icon']} />
                  <div className={s['client-form__stat-value']}>{formatCurrency(historial.total_comprado as number)}</div>
                  <div className={s['client-form__stat-label']}>Total facturado</div>
                </div>
                <div className={s['client-form__stat']}>
                  <Calendar size={20} color="#8b5cf6" className={s['client-form__stat-icon']} />
                  <div className={s['client-form__stat-value']}>{(historial.ultima_orden as string | null) || '-'}</div>
                  <div className={s['client-form__stat-label']}>Última orden</div>
                </div>
              </div>
            </div>

            {(historial.ordenes as Record<string, unknown>[]).length > 0 && (
              <div className={s['client-form__card']} style={{ marginTop: 16 }}>
                <h3 className={s['client-form__section']}>Órdenes asociadas</h3>
                <div className={s['client-form__orders']}>
                  {(historial.ordenes as Record<string, unknown>[]).map((o: Record<string, unknown>) => (
                    <div
                      key={o.numero as string}
                      className={s['client-form__order']}
                      onClick={() => navigate(`/admin/work-orders/${o.id as number}`)}
                    >
                      <div className={s['client-form__order-left']}>
                        <span className={s['client-form__order-num']}>{o.numero as string}</span>
                        <EstadoBadge estado={o.estado as string} style={{ marginLeft: 8 }} />
                      </div>
                      <div className={s['client-form__order-right']}>
                        <span className={s['client-form__order-total']}>
                          ${Number((o.total as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <ArrowRight size={14} color="#94a3b8" />
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
