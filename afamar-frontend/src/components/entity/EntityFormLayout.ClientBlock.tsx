/**
 * Client card of the shared entity form layout.
 *
 * The very same block is rendered by the wizard ("Cliente y entrega" step),
 * by the pieces-only layout (budgets) and by the legacy 2-column layout.
 * It reads the client data straight from the entity form contexts so the
 * three call sites never drift apart.
 */
import EntityFormClient from './EntityFormClient';
import { useEntityFormDomain, useEntityFormState } from './EntityFormContexts';

export default function EntityFormLayoutClientBlock() {
  const { form, readOnly, update } = useEntityFormState();
  const { clientes, addOrRefreshClientes, onAddressAdded } = useEntityFormDomain();

  return (
    <EntityFormClient
      form={form}
      readOnly={readOnly}
      update={update}
      clientes={clientes}
      onClientCreated={addOrRefreshClientes}
      onAddressAdded={onAddressAdded}
    />
  );
}
