/**
 * Pieces-only layout of the shared entity form layout.
 *
 * Single-column cascade: each piece card spans the full width and stacks
 * downward as the operator adds more mesadas. The pieces card already
 * embeds its own pools + zócalo/frente + adicionales sections, so the
 * legacy globals (MATERIALES / PILETAS / FABRICACIÓN / ADICIONALES)
 * collapse into it.
 */
import React from 'react';
import PiecesSection from '@features/budgets/components/PiecesSection';
import EntityFormLayoutClientBlock from './EntityFormLayout.ClientBlock';
import EntityFormLayoutBottomStack from './EntityFormLayout.BottomStack';
import { useEntityFormDomain, useEntityFormState } from './EntityFormContexts';
import type { EntityFormLayoutSlots } from './EntityFormLayout.types';
import type { UseBudgetPiecesReturn } from '@features/budgets/hooks/useBudgetPieces';

interface EntityFormLayoutPiecesLayoutProps {
  slots: EntityFormLayoutSlots;
  piecesFlow: UseBudgetPiecesReturn;
  fabricationShowMeasurementComparison?: boolean;
}

export default function EntityFormLayoutPiecesLayout({
  slots,
  piecesFlow,
  fabricationShowMeasurementComparison,
}: EntityFormLayoutPiecesLayoutProps) {
  const { form, readOnly } = useEntityFormState();
  const { materials: materiales, pools } = useEntityFormDomain();

  return (
    <>
      <EntityFormLayoutClientBlock />

      {slots.beforeLayout}

      <PiecesSection
        form={form}
        readOnly={readOnly}
        materials={materiales}
        pools={pools}
        pieces={piecesFlow.pieces}
        handlers={piecesFlow}
        showMeasurementComparison={fabricationShowMeasurementComparison}
      />

      <EntityFormLayoutBottomStack slots={slots} />
    </>
  );
}
