import React from 'react';
import { MapPin } from 'lucide-react';
import ClientSection from '../../components/orders/ClientSection/ClientSection';
import ClientInfoCard from '../../components/orders/ClientInfoCard/ClientInfoCard';
import type { EntityFormState } from '../../types';
import type { Client } from '../../types/client';
import styles from './WorkOrderFormClient.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderFormClientProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientes: Client[];
  onClientCreated: (newClient: Client) => void;
}

export default function WorkOrderFormClient({
  form,
  readOnly,
  update,
  clientes,
  onClientCreated,
}: WorkOrderFormClientProps) {
  // A client is considered assigned when `form.client_name` matches a row
  // in the local `clientes` list. In that case we render the read-only
  // ClientInfoCard (the form fields are sourced from the Client row, so
  // there's no value in showing them as editable inputs). Otherwise we
  // show the typeahead so the user can search for or create a client.
  const selectedClient = clientes.find((c) => c.name === form.client_name);
  const hasClient = !!form.client_name && !!selectedClient;

  // When the client has multiple addresses, expose a dropdown so the user
  // can pick the one this order is being delivered to (architect with
  // several project sites). `delivery_address_id === null` (or unset)
  // means "use the client's default address" — that's always the first
  // option, matching the legacy `client.address` mirror.
  const renderAddressPicker = (client: Client) => {
    const addresses = client.addresses || [];
    if (addresses.length <= 1 || readOnly) {
      return null;
    }
    return (
      <div className={`form-group ${s['wo-client__address-picker']}`}>
        <label className={s['wo-client__address-label']}>
          <MapPin size={14} aria-hidden="true" /> Domicilio de entrega
        </label>
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
        >
          <option value="">Principal (predeterminado)</option>
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label ? `${a.label} — ${a.address}` : a.address}
            </option>
          ))}
        </select>
        <small className={s['wo-client__address-hint']}>
          Si la obra se hace en un domicilio distinto al del cliente, elegilo acá.
        </small>
      </div>
    );
  };

  if (hasClient) {
    return (
      <div className="card">
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
    />
  );
}
