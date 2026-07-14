import React, { useState, useEffect } from 'react';
import type { Client, ClientAddress } from '../../types/client';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ClipboardList, DollarSign, Calendar, ArrowRight, Plus, X, Star, MapPin } from 'lucide-react';
import { getClient, createClient, updateClient } from '@/api/resources/clients';
import {
  getClientAddresses,
  createClientAddress,
  updateClientAddress,
  deleteClientAddress,
} from '@/api/resources/clientAddresses';
import { useCreate, useUpdate, useGet } from '../../api/hooks';
import { formatCurrencyValue } from '../../utils/formatters';
import { Modal } from '../../components/ui/Modal/Modal';
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
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ClientAddress | null>(null);
  const [addressForm, setAddressForm] = useState({ address: '', label: '', is_default: false });
  const [addressSaving, setAddressSaving] = useState(false);

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
    setAddresses((clientData.addresses as ClientAddress[]) || []);
  }, [clientData]);

  const reloadAddresses = async (): Promise<void> => {
    if (!id) return;
    const res = await getClientAddresses(Number(id));
    setAddresses((res as unknown as ClientAddress[]) || []);
  };

  const openNewAddress = (): void => {
    setEditingAddress(null);
    setAddressForm({ address: '', label: '', is_default: addresses.length === 0 });
    setShowAddressModal(true);
  };

  const openEditAddress = (a: ClientAddress): void => {
    setEditingAddress(a);
    setAddressForm({
      address: a.address,
      label: a.label || '',
      is_default: !!a.is_default,
    });
    setShowAddressModal(true);
  };

  const handleSaveAddress = async (): Promise<void> => {
    if (!id || !addressForm.address.trim()) return;
    setAddressSaving(true);
    try {
      const payload = {
        address: addressForm.address.trim(),
        label: addressForm.label.trim() || null,
        is_default: addressForm.is_default,
      };
      if (editingAddress) {
        await updateClientAddress(Number(id), editingAddress.id, payload);
        notify('Domicilio actualizado', 'success');
      } else {
        await createClientAddress(Number(id), payload);
        notify('Domicilio agregado', 'success');
      }
      await reloadAddresses();
      setShowAddressModal(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al guardar domicilio';
      notify(detail, 'error');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (a: ClientAddress): Promise<void> => {
    if (!id) return;
    if (!window.confirm(`¿Eliminar el domicilio "${a.label || a.address}"?`)) return;
    try {
      await deleteClientAddress(Number(id), a.id);
      notify('Domicilio eliminado', 'success');
      await reloadAddresses();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al eliminar domicilio';
      notify(detail, 'error');
    }
  };

  const handleSetDefault = async (a: ClientAddress): Promise<void> => {
    if (!id || a.is_default) return;
    try {
      await updateClientAddress(Number(id), a.id, { is_default: true });
      notify('Domicilio principal actualizado', 'success');
      await reloadAddresses();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al cambiar domicilio principal';
      notify(detail, 'error');
    }
  };

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
    formatCurrencyValue(n, { currency: 'ARS' });

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

              {isEdit && (
                <div className={s['client-form__group']}>
                  <div className={s['client-form__addresses-header']}>
                    <label className={s['client-form__label']}>
                      <MapPin size={14} aria-hidden="true" /> Domicilios alternativos
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={openNewAddress}
                    >
                      <Plus size={14} /> Agregar domicilio
                    </button>
                  </div>
                  {addresses.length === 0 ? (
                    <div className={s['client-form__item-empty']}>
                      Sin domicilios alternativos. El domicilio de arriba se usa como principal.
                    </div>
                  ) : (
                    <div className={s['client-form__addresses-list']}>
                      {addresses.map((a) => (
                        <div
                          key={a.id}
                          className={`${s['client-form__address-row']} ${a.is_default ? s['client-form__address-row--default'] : ''}`}
                        >
                          <div className={s['client-form__address-info']}>
                            {a.label && (
                              <span className={s['client-form__address-label']}>{a.label}</span>
                            )}
                            <span className={s['client-form__address-text']}>{a.address}</span>
                          </div>
                          <div className={s['client-form__address-actions']}>
                            {a.is_default ? (
                              <span className={s['client-form__address-default-badge']} title="Domicilio principal">
                                <Star size={12} fill="currentColor" aria-hidden="true" /> Principal
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => handleSetDefault(a)}
                                title="Marcar como domicilio principal"
                              >
                                Hacer principal
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => openEditAddress(a)}
                              aria-label="Editar domicilio"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleDeleteAddress(a)}
                              aria-label="Eliminar domicilio"
                              disabled={addresses.length <= 1}
                              title={addresses.length <= 1 ? 'El cliente debe tener al menos un domicilio' : 'Eliminar'}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                            {formatCurrencyValue(Number((b.total as number) || 0), { decimals: 0 })}
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
                            {formatCurrencyValue(Number((o.total as number) || 0), { decimals: 0 })}
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

      <Modal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title={editingAddress ? 'Editar domicilio' : 'Nuevo domicilio'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveAddress();
          }}
        >
          <div className="form-group">
            <label>Etiqueta (ej. Casa, Oficina, Cliente 1)</label>
            <input
              className="input"
              value={addressForm.label}
              onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
              placeholder="Principal"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Dirección *</label>
            <input
              className="input"
              required
              value={addressForm.address}
              onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
              placeholder="Calle N° - Ciudad - Provincia"
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="address-default"
              type="checkbox"
              checked={addressForm.is_default}
              onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
            />
            <label htmlFor="address-default" style={{ marginBottom: 0 }}>
              Marcar como domicilio principal
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowAddressModal(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={addressSaving || !addressForm.address.trim()}
            >
              {addressSaving ? 'Guardando...' : editingAddress ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}