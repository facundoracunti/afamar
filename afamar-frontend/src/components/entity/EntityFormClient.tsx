import React, { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import ClientSection from '../../components/orders/ClientSection/ClientSection';
import ClientInfoCard from '../../components/orders/ClientInfoCard/ClientInfoCard';
import { createClientAddress } from '@/api/resources/clientAddresses';
import { useNotify } from '../../context/NotificationContext';
import type { EntityFormState } from '../../types';
import type { Client, ClientAddress } from '../../types/client';
import styles from './EntityFormClient.module.css';

const s = styles as unknown as Record<string, string>;

interface EntityFormClientProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientes: Client[];
  onClientCreated: (newClient: Client) => void;
  onAddressAdded?: (clientId: number, address: ClientAddress) => void;
  cardClassName?: string;
}

export default function EntityFormClient({
  form,
  readOnly,
  update,
  clientes,
  onClientCreated,
  onAddressAdded,
  cardClassName = 'card',
}: EntityFormClientProps) {
  const [newAddrText, setNewAddrText] = useState('');
  const [addingAddr, setAddingAddr] = useState(false);
  const notify = useNotify();

  const selectedClient = clientes.find((c) => c.name === form.client_name);
  const hasClient = !!form.client_name && !!selectedClient;

  const handleAddAddress = async () => {
    if (!selectedClient || !newAddrText.trim()) return;
    setAddingAddr(true);
    try {
      const created = await createClientAddress(selectedClient.id, { address: newAddrText.trim() });
      onAddressAdded?.(selectedClient.id, created);
      update('delivery_address_id', created.id);
      update('client_address', created.address);
      setNewAddrText('');
      notify('Dirección agregada', 'success');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      notify(detail || 'Error al agregar dirección', 'error');
    } finally {
      setAddingAddr(false);
    }
  };

  const renderAddressPicker = (client: Client) => {
    const addresses = client.addresses || [];
    const showSelect = addresses.length > 1;
    return (
      <div className={`form-group ${s['entity-form-client__address-picker']}`}>
        <label className={s['entity-form-client__address-label']}>
          <MapPin size={14} aria-hidden="true" /> Domicilio de entrega
        </label>
        <div className={s['entity-form-client__addr-row']}>
          {showSelect ? (
            <select
              className="input"
              value={form.delivery_address_id ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                update('delivery_address_id', val);
                if (val) {
                  const picked = addresses.find((a) => a.id === val);
                  if (picked) update('client_address', picked.address);
                } else {
                  update('client_address', client.address || '');
                }
              }}
              style={{ flex: 1 }}
            >
              <option value="">Principal (predeterminado)</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ? `${a.label} — ${a.address}` : a.address}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={client.address || ''}
              readOnly
              style={{ flex: 1 }}
            />
          )}
          {!readOnly && (
            <>
              <input
                className={s['entity-form-client__addr-new-input']}
                placeholder="Nueva dirección..."
                value={newAddrText}
                onChange={(e) => setNewAddrText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAddress(); } }}
                disabled={addingAddr}
              />
              <button
                type="button"
                className={s['entity-form-client__addr-new-btn']}
                onClick={handleAddAddress}
                disabled={addingAddr || !newAddrText.trim()}
              >
                <Plus size={14} />
              </button>
            </>
          )}
        </div>
        {showSelect && (
          <small className={s['entity-form-client__address-hint']}>
            Si la obra se hace en un domicilio distinto al del cliente, elegilo acá.
          </small>
        )}
      </div>
    );
  };

  if (hasClient) {
    return (
      <div className={cardClassName}>
        <ClientInfoCard client={selectedClient} />
        {renderAddressPicker(selectedClient)}
      </div>
    );
  }

  return (
    <ClientSection
      form={form}
      readOnly={readOnly}
      update={update}
      clientes={clientes}
      onClientCreated={onClientCreated}
      onAddressAdded={onAddressAdded}
    />
  );
}
