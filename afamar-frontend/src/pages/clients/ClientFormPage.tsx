import React, { useState, useEffect } from 'react';
import type { Client } from '../../types/client';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ClipboardList, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { getClient, createClient, updateClient } from '@/api/resources/clients';
import { useCreate, useUpdate, useGet } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormActions } from '../../components/ui/FormActions/FormActions';
import { useNotify } from '../../context/NotificationContext';
import styles from './ClientFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const CLIENTS_KEY = ['clients'] as const;

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const [cliente, setCliente] = useState({
    name: '', phone: '', email: '', address: '', notes: '',
  });

  const { data: clientData, loading } = useGet<Record<string, unknown>>(
    ['client', id],
    async () => {
      if (!id) return {};
      const res = await getClient(id);
      return (res.data as Record<string, unknown>) || {};
    },
    !!id
  );

  useEffect(() => {
    if (!clientData) return;
    setCliente({
      name: (clientData.name as string) || '',
      phone: (clientData.phone as string) || '',
      email: (clientData.email as string) || '',
      address: (clientData.address as string) || '',
      notes: (clientData.notes as string) || '',
    });
  }, [clientData]);

  const historial = clientData
    ? {
        total_budgets: (clientData.total_budgets as number) || 0,
        total_orders: (clientData.total_orders as number) || 0,
        total_purchased: (clientData.total_purchased as number) || 0,
        last_order: clientData.last_order_number as string | null,
        orders: (clientData.orders as Record<string, unknown>[]) || [],
        budgets: (clientData.budgets as Record<string, unknown>[]) || [],
        created_at: clientData.created_at as string,
      }
    : null;

  const createMutation = useCreate<unknown, Record<string, unknown>>(
    CLIENTS_KEY,
    async (variables) => { await createClient(variables); },
    { invalidateKeys: [CLIENTS_KEY] }
  );

  const updateMutation = useUpdate<unknown, { id: string; data: Record<string, unknown> }>(
    CLIENTS_KEY,
    async (variables) => { await updateClient(variables.id, variables.data); },
    { invalidateKeys: [CLIENTS_KEY] }
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: id as string, data: cliente });
      } else {
        await createMutation.mutateAsync(cliente);
      }
      // Invalidate ensures ClientsListPage refreshes the table after navigation.
      navigate('/admin/clients');
    } catch (err: unknown) {
      const apiErr = err as Record<string, unknown>;
      const response = apiErr.response as Record<string, unknown> | undefined;
      const data = response?.data as Record<string, unknown> | undefined;
      notify((data?.detail as string) || 'Error al guardar cliente', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || (isEdit && !clientData)) return <LoadingSpinner />;

  const formatCurrency = (n: number): string =>
    `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className={s['client-form']}>
      <h1 className={s['client-form__title']}>
        {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
      </h1>

      <div className={s['client-form__layout']}>
        {/* Row 1: Datos del cliente (left) + Historial del cliente (right) */}
        <div className={s['client-form__row']}>
          <div className={s['client-form__col']}>
            <form onSubmit={handleSubmit} className={`${s['client-form__card']} ${s['client-form__card--fill']}`}>
              <h3 className={s['client-form__section']}>Datos del cliente</h3>
              <div className={s['client-form__form-row']}>
                <div className={s['client-form__group']}>
                  <label className={s['client-form__label']}>Nombre *</label>
                  <input className="input" required value={cliente.name} onChange={(e) => setCliente({ ...cliente, name: e.target.value })} />
                </div>
                <div className={s['client-form__group']}>
                  <label className={s['client-form__label']}>Teléfono</label>
                  <input className="input" value={cliente.phone || ''} onChange={(e) => setCliente({ ...cliente, phone: e.target.value })} />
                </div>
              </div>
              <div className={s['client-form__form-row']}>
                <div className={s['client-form__group']}>
                  <label className={s['client-form__label']}>Correo</label>
                  <input className="input" type="email" value={cliente.email || ''} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
                </div>
                <div className={s['client-form__group']}>
                  <label className={s['client-form__label']}>Dirección</label>
                  <input className="input" value={cliente.address || ''} onChange={(e) => setCliente({ ...cliente, address: e.target.value })} />
                </div>
              </div>
              <div className={s['client-form__group']}>
                <label className={s['client-form__label']}>Observaciones</label>
                <textarea className="input" rows={3} value={cliente.notes || ''} onChange={(e) => setCliente({ ...cliente, notes: e.target.value })} />
              </div>

              <FormActions
                loading={saving}
                submitLabel={isEdit ? 'Actualizar' : 'Crear Cliente'}
                onCancel={() => navigate('/admin/clients')}
              />
            </form>
          </div>

          {isEdit && historial && (
            <div className={s['client-form__col']}>
              <div className={`${s['client-form__card']} ${s['client-form__card--fill']}`}>
                <h3 className={s['client-form__section']}>Historial del cliente</h3>
                <div className={s['client-form__stats']}>
                  <div className={s['client-form__stat']}>
                    <FileText size={20} color="#3b82f6" className={s['client-form__stat-icon']} />
                    <div className={s['client-form__stat-value']}>{(historial.total_budgets as number)}</div>
                    <div className={s['client-form__stat-label']}>Presupuestos</div>
                  </div>
                  <div className={s['client-form__stat']}>
                    <ClipboardList size={20} color="#059669" className={s['client-form__stat-icon']} />
                    <div className={s['client-form__stat-value']}>{(historial.total_orders as number)}</div>
                    <div className={s['client-form__stat-label']}>Órdenes</div>
                  </div>
                  <div className={s['client-form__stat']}>
                    <DollarSign size={20} color="#d97706" className={s['client-form__stat-icon']} />
                    <div className={s['client-form__stat-value']}>{formatCurrency(historial.total_purchased as number)}</div>
                    <div className={s['client-form__stat-label']}>Total facturado</div>
                  </div>
                  <div className={s['client-form__stat']}>
                    <Calendar size={20} color="#8b5cf6" className={s['client-form__stat-icon']} />
                    <div className={s['client-form__stat-value']}>{(historial.last_order as string | null) || '-'}</div>
                    <div className={s['client-form__stat-label']}>Última orden</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Presupuestos asociados (left) + Órdenes asociadas (right) */}
        {isEdit && historial && (
          <div className={s['client-form__row']}>
            <div className={s['client-form__col']}>
              <div className={`${s['client-form__card']} ${s['client-form__card--fill']}`}>
                <h3 className={s['client-form__section']}>Presupuestos asociados</h3>
                {(historial.budgets as Record<string, unknown>[]).length > 0 ? (
                  <div className={s['client-form__items-list']}>
                    {(historial.budgets as Record<string, unknown>[]).map((b: Record<string, unknown>) => (
                      <div
                        key={b.number as string}
                        className={s['client-form__item']}
                        onClick={() => navigate(`/admin/budgets/${b.id as number}`)}
                      >
                        <div className={s['client-form__item-left']}>
                          <span className={s['client-form__item-num']}>{b.number as string}</span>
                          <StatusBadge status={b.status as string} />
                        </div>
                        <div className={s['client-form__item-right']}>
                          <span className={s['client-form__item-total']}>
                            ${Number((b.total as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <ArrowRight size={14} color="#94a3b8" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={s['client-form__item-empty']}>Sin presupuestos asociados.</div>
                )}
              </div>
            </div>

            <div className={s['client-form__col']}>
              <div className={`${s['client-form__card']} ${s['client-form__card--fill']}`}>
                <h3 className={s['client-form__section']}>Órdenes asociadas</h3>
                {(historial.orders as Record<string, unknown>[]).length > 0 ? (
                  <div className={s['client-form__items-list']}>
                    {(historial.orders as Record<string, unknown>[]).map((o: Record<string, unknown>) => (
                      <div
                        key={o.number as string}
                        className={s['client-form__item']}
                        onClick={() => navigate(`/admin/work-orders/${o.id as number}`)}
                      >
                        <div className={s['client-form__item-left']}>
                          <span className={s['client-form__item-num']}>{o.number as string}</span>
                          <StatusBadge status={o.status as string} />
                        </div>
                        <div className={s['client-form__item-right']}>
                          <span className={s['client-form__item-total']}>
                            ${Number((o.total as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <ArrowRight size={14} color="#94a3b8" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={s['client-form__item-empty']}>Sin órdenes asociadas.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}