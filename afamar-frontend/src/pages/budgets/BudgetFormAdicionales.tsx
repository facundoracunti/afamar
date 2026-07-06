import React from 'react';
import PoolSection from '../../components/materials/PoolSection/PoolSection';
import type { EntityFormState } from '../../types';

interface BudgetFormAdicionalesProps {
  form: EntityFormState;
  readOnly: boolean;
  pools: Record<string, unknown>[];
  update: (field: string, value: unknown) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  addPileta: (id: string) => void;
  num: (v: string) => number | null;
}

export default function BudgetFormAdicionales({
  form,
  readOnly,
  pools,
  update,
  updatePileta,
  removePileta,
  addPileta,
  num,
}: BudgetFormAdicionalesProps) {
  return (
    <PoolSection
      pools={pools}
      formPiletas={form.pools_data as unknown as Record<string, unknown>[]}
      readOnly={readOnly}
      addPileta={addPileta}
      updatePileta={updatePileta}
      removePileta={removePileta}
      update={update}
      num={num as (v: unknown) => number}
    />
  );
}