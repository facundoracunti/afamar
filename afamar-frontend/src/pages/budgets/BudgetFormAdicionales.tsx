import React from 'react';
import PoolSection from '../../components/materials/PoolSection/PoolSection';
import type { EntityFormState } from '../../types';
import type { MaterialInForm, PoolInForm } from '../../types/budget';

interface BudgetFormAdicionalesProps {
  form: EntityFormState;
  readOnly: boolean;
  /** Pool catalog (from /pool-stock). */
  pools: Record<string, unknown>[];
  /** Materials added to this budget — forwarded to PoolSection so the
   *  per-pool "Asignar a opción" picker only shows the materials the user
   *  has actually loaded on this document. */
  formMaterials: MaterialInForm[];
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  addPileta: (id: string) => void;
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
  num,
}: BudgetFormAdicionalesProps) {
  return (
    <PoolSection
      pools={pools}
      formPiletas={(form.pools_data as unknown as PoolInForm[]) || []}
      formMaterials={formMaterials}
      readOnly={readOnly}
      addPileta={addPileta}
      updatePileta={updatePileta}
      removePileta={removePileta}
      num={num as (v: unknown) => number}
    />
  );
}
