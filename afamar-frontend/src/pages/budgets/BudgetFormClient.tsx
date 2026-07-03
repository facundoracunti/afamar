import React from 'react';
import ClientSection from '../../components/orders/ClientSection';
import type { EntityFormState } from '../../types';
import type { Client } from '../../types/client';

interface BudgetFormClientProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientes: Client[];
  onClientCreated: () => void;
}

export default function BudgetFormClient({
  form,
  readOnly,
  update,
  clientes,
  onClientCreated,
}: BudgetFormClientProps) {
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
