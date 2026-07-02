import React from 'react';
import { formatCurrency, conceptosFabricacion } from '../../utils/formatters';
import FabricacionTable from '../../components/presupuesto/FabricacionTable';
import type { EntityFormState } from '../../types';

interface BudgetFormItemsProps {
  form: EntityFormState;
  readOnly: boolean;
  materiales: Record<string, unknown>[];
  CONCEPTOS_M2: string[];
  num: (v: string) => number | null;
  handleDetalleChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
}

export default function BudgetFormItems({
  form,
  readOnly,
  materiales,
  CONCEPTOS_M2,
  num,
  handleDetalleChange,
  addDetalle,
  removeDetalle,
}: BudgetFormItemsProps) {
  return (
    <div className="card">
      <FabricacionTable
        detalles={form.detalles_fabricacion as unknown as Record<string, unknown>[]}
        readOnly={readOnly}
        handleDetalleChange={handleDetalleChange}
        addDetalle={addDetalle}
        removeDetalle={removeDetalle}
        materiales={materiales}
        CONCEPTOS_M2={CONCEPTOS_M2}
        conceptosFabricacion={conceptosFabricacion}
        num={num as (v: unknown) => number}
      />
    </div>
  );
}