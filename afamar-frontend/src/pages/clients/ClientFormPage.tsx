import React, { useState, useEffect } from 'react';
import type { ClientAddress } from '../../types/client';
import { useNavigate, useParams } from 'react-router-dom';
import { getClient, createClient, updateClient } from '@/api/resources/clients';
import { parseApiError } from '../../utils/error';
import { useCreate, useUpdate, useGet } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { FormActions } from '../../components/ui/FormActions/FormActions';
import { useNotify } from '../../context/NotificationContext';
import { useClientAddresses } from '../../hooks/useClientAddresses';
import { ClientHistoryCard } from '../../components/common/ClientHistoryCard';
import { ClientContactFields, type ClientFormValues } from './ClientContactFields';
import { ClientAddressesPanel } from './ClientAddressesPanel';
import { ClientAddressModal } from './ClientAddressModal';
import styles from './ClientFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const CLIENTS_KEY = ['clients'] as const;

interface ClientFormProps {
  /** Modal mode: cierra el modal en vez de navegar a /admin/clients. */
  onSuccess?: () => void;
  /** Modal mode: cierra el modal en vez de navegar a /admin/clients. */
  onCancel?: () => void;
  /** Modal mode: id del cliente a editar. Si no se pasa, usa useParams(). */
  entityId?: number | string;
}

export default function ClientForm(props: ClientFormProps = {}) {
  const params = useParams();
  const paramId = params.id;
  const id = props.entityId != null ? String(props.entityId) : paramId;
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const [cliente, setCliente] = useState<ClientFormValues>({
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
  } = useClientAddresses({ clientId: id });

  const { data: clientData, loading } = useGet<Record<string, unknown>>(
    ['client', id],
    async () => {
      if (!id) return {};
      const res = await getClient(id);
      return res.data || {};
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

  const handleChange = (field: keyof ClientFormValues, value: string) => {
    setCliente((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: id as string, data: cliente });
      } else {
        await createMutation.mutateAsync(cliente);
      }
      if (props.onSuccess) {
        props.onSuccess();
      } else {
        navigate('/admin/clients');
      }
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al guardar cliente'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (props.onCancel) props.onCancel();
    else navigate('/admin/clients');
  };

  if (loading || (isEdit && !clientData)) return <LoadingSpinner />;

  const isModal = Boolean(props.onCancel || props.onSuccess);

  return (
    <div className={s['client-form']}>
      {!isModal && (
        <h1 className={s['client-form__title']}>
          {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h1>
      )}

      <div className={`${s['client-form__layout']} ${isEdit ? s['client-form__layout--edit'] : s['client-form__layout--create']}`}>
        {isEdit ? (
          <div className={s['client-form__row']}>
            <div className={s['client-form__col']}>
              <form
                onSubmit={handleSubmit}
                className={`${s['client-form__card']} ${s['client-form__card--fill']}`}
              >
                <h3 className={s['client-form__section']}>Datos del cliente</h3>
                <ClientContactFields values={cliente} onChange={handleChange} />
                <FormActions
                  className={s['client-form__actions--push']}
                  loading={saving}
                  submitLabel="Actualizar"
                  onCancel={handleCancel}
                />
              </form>
            </div>

            <div className={s['client-form__col']}>
              <div className={`${s['client-form__card']} ${s['client-form__card--fill']}`}>
                <h3 className={s['client-form__section']}>Notas y domicilios</h3>
                <div className={s['client-form__group']}>
                  <label className={s['client-form__label']}>Observaciones</label>
                  <textarea className="input" rows={4} value={cliente.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} />
                </div>

                {isEdit && clientData && (
                  <ClientAddressesPanel
                    addresses={addresses}
                    onOpenNew={openNewAddress}
                    onEdit={openEditAddress}
                    onDelete={handleDeleteAddress}
                    onSetDefault={handleSetDefault}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={s['client-form__row']}>
            <div className={s['client-form__col']}>
              <form
                onSubmit={handleSubmit}
                className={`${s['client-form__card']} ${s['client-form__card--fill']}`}
              >
                <h3 className={s['client-form__section']}>Datos del cliente</h3>
                <ClientContactFields values={cliente} onChange={handleChange} />
                <div className={s['client-form__group']}>
                  <label className={s['client-form__label']}>Observaciones</label>
                  <textarea className="input" rows={3} value={cliente.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} />
                </div>
                <FormActions
                  loading={saving}
                  submitLabel="Crear Cliente"
                  onCancel={handleCancel}
                />
              </form>
            </div>
          </div>
        )}

        {isEdit && clientData && !isModal && (
          <div className={s['client-form__row']}>
            <div className={s['client-form__col']}>
              <ClientHistoryCard clientData={clientData} client={undefined} />
            </div>
          </div>
        )}
      </div>

      <ClientAddressModal
        open={showAddressModal}
        editing={!!editingAddress}
        form={addressForm}
        saving={addressSaving}
        onChange={setAddressForm}
        onSave={() => { void handleSaveAddress(); }}
        onClose={() => setShowAddressModal(false)}
      />
    </div>
  );
}
