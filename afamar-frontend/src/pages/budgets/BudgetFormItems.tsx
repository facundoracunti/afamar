import React from 'react';
import { formatCurrency, fabricationConcepts } from '../../utils/formatters';
import FabricationTable from '../../components/budget/FabricationTable';
import type { EntityFormState } from '../../types';

interface BudgetFormItemsProps {
  form: EntityFormState;
  readOnly: boolean;
  materiales: Record<string, unknown>[];
  M2_CONCEPTS: string[];
  num: (v: string) => number | null;
  handleDetailChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
}

export default function BudgetFormItems({
  form,
  readOnly,
  materiales,
  M2_CONCEPTS,
  num,
  handleDetailChange,
  addDetalle,
  removeDetalle,
}: BudgetFormItemsProps) {
  return (
    <div className="card">
      <FabricationTable
        detalles={form.fabrication_details as unknown as Record<string, unknown>[]}
        readOnly={readOnly}
        handleDetailChange={handleDetailChange}
        addDetalle={addDetalle}
        removeDetalle={removeDetalle}
        materiales={materiales}
        M2_CONCEPTS={M2_CONCEPTS}
        fabricationConcepts={fabricationConcepts}
        num={num as (v: unknown) => number}
      />
    </div>
  );
}