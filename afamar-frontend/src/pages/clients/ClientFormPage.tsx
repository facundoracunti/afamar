import React, { useState, useEffect } from 'react';
import type { ClientAddress } from '../../types/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, Star, MapPin } from 'lucide-react';
import { getClient, createClient, updateClient } from '@/api/resources/clients';
import { useCreate, useUpdate, useGet } from '../../api/hooks';
import { Modal } from '../../components/ui/Modal/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { FormActions } from '../../components/ui/FormActions/FormActions';
import { useNotify } from '../../context/NotificationContext';
import { useClientAddresses } from '../../hooks/useClientAddresses';
import { ClientHistoryCard } from '../../components/common/ClientHistoryCard';
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

  const {
    addresses, setAddresses,
    showAddressModal, setShowAddressModal,
    editingAddress,
    addressForm, setAddressForm,
    addressSaving,
    openNewAddress, openEditAddress,
    handleSaveAddress, handleDeleteAddress, handleSetDefault,
    reloadAddresses,
  } = useClientAddresses({ clientId: id });

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
  }, [clientData, setAddresses]);

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

  return (
    <div className={s['client-form']}>
      <h1 className={s['client-form__title']}>
        {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
      </h1>

      <div className={s['client-form__layout']}>
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
                    <button type="button" className="btn btn-outline" onClick={openNewAddress}>
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
                              <button type="button" className="btn btn-outline" onClick={() => handleSetDefault(a)} title="Marcar como domicilio principal">
                                Hacer principal
                              </button>
                            )}
                            <button type="button" className="btn btn-outline" onClick={() => openEditAddress(a)} aria-label="Editar domicilio">
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

          {isEdit && clientData && (
            <div className={s['client-form__col']}>
              <ClientHistoryCard clientData={clientData} client={undefined} />
            </div>
          )}
        </div>
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
            <button type="button" className="btn btn-outline" onClick={() => setShowAddressModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={addressSaving || !addressForm.address.trim()}>
              {addressSaving ? 'Guardando...' : editingAddress ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
