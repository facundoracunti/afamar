import React from 'react';
import PoolSection from '../../components/materials/PoolSection/PoolSection';
import type { EntityFormState } from '../../types';
import type { MaterialInForm, PoolInForm } from '../../types/budget';
import type { Pool } from '../../types/poolStock';

interface BudgetFormAdicionalesProps {
  form: EntityFormState;
  readOnly: boolean;
  /** Pool catalog (from /pool-stock). */
  pools: Pool[];
  /** Materials added to this budget — forwarded to PoolSection so the
   *  per-pool "Asignar a opción" picker only shows the materials the user
   *  has actually loaded on this document. */
  formMaterials: MaterialInForm[];
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  addPileta: (id: string) => void;
  setPoolFields: (idx: number, fields: Record<string, unknown>) => void;
  num: (v: string) => number | null;
}

export default function BudgetFormAdicionales({
  form,
  readOnly,
  pools,
  formMaterials,
  updatePileta,
  removePileta,
  addPileta,
  setPoolFields,
  num,
}: BudgetFormAdicionalesProps) {
  return (
    <PoolSection
      pools={pools}
      formPiletas={form.pools_data || []}
      formMaterials={formMaterials}
      readOnly={readOnly}
      addPileta={addPileta}
      updatePileta={updatePileta}
      removePileta={removePileta}
      setPoolFields={setPoolFields}
      num={num as (v: unknown) => number}
    />
  );
}
