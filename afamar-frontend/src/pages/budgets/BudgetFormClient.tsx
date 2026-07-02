import React from 'react';
import ClienteSection from '../../components/ordenes/ClienteSection';
import type { EntityFormState } from '../../types';

interface BudgetFormClientProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clienteRef: React.RefObject<HTMLDivElement>;
  showClienteDropdown: boolean;
  setShowClienteDropdown: (v: boolean) => void;
  clientesFiltrados: unknown[];
  handleClienteSelect: (c: Record<string, unknown>) => void;
}

export default function BudgetFormClient({
  form,
  readOnly,
  update,
  clienteRef,
  showClienteDropdown,
  setShowClienteDropdown,
  clientesFiltrados,
  handleClienteSelect,
}: BudgetFormClientProps) {
  return (
    <ClienteSection
      form={form}
      readOnly={readOnly}
      update={update}
      clienteRef={clienteRef}
      showClienteDropdown={showClienteDropdown}
      setShowClienteDropdown={setShowClienteDropdown}
      clientesFiltrados={clientesFiltrados}
      handleClienteSelect={handleClienteSelect}
    />
  );
}