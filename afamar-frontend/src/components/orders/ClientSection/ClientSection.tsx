import React, { useState } from 'react';
import { createClientAddress } from '@/api/resources/clientAddresses';
import { useNotify } from '../../../context/NotificationContext';
import type { EntityFormState } from '../../../types/form';
import type { Client, ClientAddress } from '../../../types/client';
import { ClientTypeahead } from './ClientTypeahead';
import { AddressPicker } from './AddressPicker';
import { NewClientModal } from './NewClientModal';
import styles from './ClientSection.module.css';

const s = styles as unknown as Record<string, string>;

interface ClientSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientes: Client[];
  onClientCreated: (newClient: Client) => void;
  onAddressAdded?: (clientId: number, address: ClientAddress) => void;
}

export default function ClientSection({
  form,
  readOnly,
  update,
  clientes,
  onClientCreated,
  onAddressAdded,
}: ClientSectionProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const notify = useNotify();

  const selectedClient = clientes.find((c) => c.name === form.client_name);
  const addresses: ClientAddress[] = selectedClient?.addresses || [];
  const hasMultipleAddresses = addresses.length > 1;

  const handleSelect = (c: Client) => {
    update('client_name', c.name);
    update('client_phone', c.phone || '');
    update('client_email', c.email || '');
    update('client_address', c.address || '');
    update('delivery_address_id', null);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    update('client_name', '');
    update('client_phone', '');
    update('client_email', '');
    update('client_address', '');
    update('delivery_address_id', null);
    setQuery('');
  };

  const handleAddressSelect = (addr: ClientAddress) => {
    update('delivery_address_id', addr.id);
    update('client_address', addr.address);
  };

  const handleAddressClear = () => {
    update('delivery_address_id', null);
    if (selectedClient) {
      update('client_address', selectedClient.address || '');
    }
  };

  const handleAddAddress = async (text: string) => {
    if (!selectedClient) return;
    const created = await createClientAddress(selectedClient.id, { address: text });
    onAddressAdded?.(selectedClient.id, created as ClientAddress);
    update('delivery_address_id', (created as ClientAddress).id);
    update('client_address', (created as ClientAddress).address);
    notify('Dirección agregada', 'success');
  };

  const handleCreateNew = (name: string) => {
    setQuery(name);
    setShowModal(true);
    setOpen(false);
  };

  const handleClientCreated = (client: Client) => {
    update('client_name', client.name);
    update('client_phone', client.phone || '');
    update('client_email', client.email || '');
    update('client_address', client.address || '');
    update('delivery_address_id', null);
    onClientCreated(client);
    setQuery('');
  };

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="orden-grid-4">
          <div className="form-group">
            <label>Fecha</label>
            <input
              type="date"
              className="input"
              value={form.date || ''}
              onChange={(e) => update('date', e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="form-group">
            <label>Cliente</label>
            <ClientTypeahead
              value={form.client_name}
              query={query}
              open={open}
              clientes={clientes}
              readOnly={readOnly}
              onQueryChange={setQuery}
              onOpen={setOpen}
              onSelect={handleSelect}
              onClear={handleClear}
              onCreateNew={handleCreateNew}
            />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input
              className="input"
              value={form.client_phone}
              onChange={(e) => update('client_phone', e.target.value)}
              placeholder="Teléfono"
              disabled={readOnly}
            />
          </div>
          <div className="form-group">
            <label>E-mail</label>
            <input
              className="input"
              value={form.client_email}
              onChange={(e) => update('client_email', e.target.value)}
              placeholder="Correo"
              disabled={readOnly}
            />
          </div>
        </div>

        {hasMultipleAddresses && selectedClient && !readOnly && (
          <div className={s['client-section__addr-row']}>
            <div className={s['client-section__addr-label']}>Dirección de obra:</div>
            <AddressPicker
              addresses={addresses}
              selectedAddressId={form.delivery_address_id}
              clientAddress={selectedClient.address || ''}
              readOnly={readOnly}
              onSelect={handleAddressSelect}
              onClear={handleAddressClear}
              onAddNew={handleAddAddress}
            />
          </div>
        )}

        <div className="form-group" style={{ marginTop: 8 }}>
          <label>Domicilio</label>
          <input
            className="input"
            value={form.client_address}
            onChange={(e) => {
              update('client_address', e.target.value);
              if (form.delivery_address_id) {
                update('delivery_address_id', null);
              }
            }}
            placeholder="Calle N° - Ciudad - Provincia"
            disabled={readOnly}
          />
        </div>
      </div>

      <NewClientModal
        isOpen={showModal}
        initialName={query}
        onClose={() => setShowModal(false)}
        onCreated={handleClientCreated}
      />
    </>
  );
}
