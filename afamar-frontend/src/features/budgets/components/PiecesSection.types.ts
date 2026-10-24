/**
 * Shared types of the pieces editor (`PiecesSection`).
 *
 * They live in their own module so the sub-components
 * (`PiecesSection.SingularMaterialCard`, `PiecesSection.PiecePools`,
 * `PiecesSection.PieceCard`) can share the contract without importing
 * the orchestrator (which would create an import cycle).
 */
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type { BudgetPiece } from '@/types/budget';
import type { Pool } from '@/types/poolStock';
import type { UseBudgetPiecesReturn } from '@features/budgets/hooks/useBudgetPieces';

/** Every piece handler exposed by the pieces hook (the list itself is
 *  owned by the caller). */
export type PieceHandlers = Omit<UseBudgetPiecesReturn, 'pieces'>;

export interface PiecesSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  materials: Material[];
  /** Pool catalog (from /pool-stock). */
  pools: Pool[];
  pieces: BudgetPiece[];
  handlers: PieceHandlers;
  /**
   * OT-specific: shows the inline COMPARATIVA DE MEDICIÓN (M² Real vs
   * Presupuestado) inside each piece's fabrication section when the work
   * order is in MEASUREMENT. Budgets never pass this.
   */
  showMeasurementComparison?: boolean;
}
