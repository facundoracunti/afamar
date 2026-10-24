/**
 * ORCHESTRATOR of the pure mutation helpers for the pieces-flow
 * (`useBudgetPieces`).
 *
 * The helpers themselves live in focused, single-responsibility modules
 * next to this file:
 *
 *   - `useBudgetPieces.helpers.pieces.ts`       → piece-level primitives
 *   - `useBudgetPieces.helpers.pricing.ts`      → re-pricing of the rows
 *                                                  that depend on a
 *                                                  material's $/m²
 *   - `useBudgetPieces.helpers.materials.ts`     → principal material
 *   - `useBudgetPieces.helpers.alternatives.ts`  → alternative materials
 *   - `useBudgetPieces.helpers.alternativeSwap.ts` → swap / toggle of an
 *                                                  alternative card
 *   - `useBudgetPieces.helpers.fabrication.ts`   → zócalo / frente rows
 *   - `useBudgetPieces.helpers.additionalWorks.ts` → additional works
 *   - `useBudgetPieces.helpers.pools.ts`         → piletas
 *
 * This file only re-exports the PUBLIC names so every consumer (the hook
 * and its tests) keeps importing from the very same path.
 *
 * Blocked invariants preserved from the original single-file hook:
 * - "same mesada, different material": alternatives mirror the principal's
 *   length/width/quantity.
 * - Append, never replace, for alternatives (each new pick adds a slot;
 *   re-picking an already-present material is a no-op via `groupKeyOf`).
 * - Dim edits on the principal mirror into the alternatives; $/m² or
 *   currency edits re-price the piece's `frente` additional works via
 *   `refreshPieceFrentes` (see `FRENTE_PRICE_FIELDS`).
 */
export { FRENTE_PRICE_FIELDS, groupKeyOf, pieceDims, pieceMainPrices } from './useBudgetPieces.helpers.pieces';
export { refreshPieceFabricationDetails } from './useBudgetPieces.helpers.pricing';
export {
  mutateAddPieceMainRow,
  mutateRemovePieceMain,
  mutateRemovePieceMainRow,
  mutateSetPieceMain,
  mutateSwapPieceMain,
  mutateUpdatePieceMain,
  mutateUpdatePieceMainGroup,
  mutateUpdatePieceMainRow,
} from './useBudgetPieces.helpers.materials';
export {
  mutateAddPieceAlternative,
  mutateAddPieceAlternativeRow,
  mutateRemovePieceAlternative,
  mutateRemovePieceAlternativeRow,
  mutateUpdatePieceAlternative,
  mutateUpdatePieceAlternativeGroup,
} from './useBudgetPieces.helpers.alternatives';
export {
  mutateSwapPieceAlternative,
  mutateTogglePieceAlternative,
} from './useBudgetPieces.helpers.alternativeSwap';
export {
  mutateAddPieceFabrication,
  mutateRemovePieceFabrication,
  mutateUpdatePieceFabrication,
} from './useBudgetPieces.helpers.fabrication';
export { mutateSetPieceAdditionalWorks } from './useBudgetPieces.helpers.additionalWorks';
export {
  mutateRemovePiecePool,
  mutateSetPiecePoolFields,
  mutateUpdatePiecePool,
} from './useBudgetPieces.helpers.pools';
