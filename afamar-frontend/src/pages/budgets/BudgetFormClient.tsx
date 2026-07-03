import React from 'react';
import ClientSection from '../../components/orders/ClientSection';
import type { EntityFormState } from '../../types';

interface BudgetFormClientProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientRef: React.RefObject<HTMLDivElement>;
  showClientDropdown: boolean;
  setShowClientDropdown: (v: boolean) => void;
  filteredClients: unknown[];
  handleClientSelect: (c: Record<string, unknown>) => void;
}

export default function BudgetFormClient({
  form,
  readOnly,
  update,
  clientRef,
  showClientDropdown,
  setShowClientDropdown,
  filteredClients,
  handleClientSelect,
}: BudgetFormClientProps) {
  return (
    <ClientSection
      form={form}
      readOnly={readOnly}
      update={update}
      clientRef={clientRef}
      showClientDropdown={showClientDropdown}
      setShowClientDropdown={setShowClientDropdown}
      filteredClients={filteredClients}
      handleClientSelect={handleClientSelect}
    />
  );
}