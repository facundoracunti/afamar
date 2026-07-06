import React from 'react';
import ClientSection from '../../components/orders/ClientSection/ClientSection';
import ClientInfoCard from '../../components/orders/ClientInfoCard/ClientInfoCard';
import type { EntityFormState } from '../../types';
import type { Client } from '../../types/client';

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

  if (hasClient) {
    return (
      <div className="card">
        <ClientInfoCard client={selectedClient} />
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
