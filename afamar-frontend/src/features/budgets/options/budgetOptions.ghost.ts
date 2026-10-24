/**
 * The GHOST PIECE of an EMPTY option.
 *
 * A brand-new option is created EMPTY (`pieces: []`), but the pieces
 * editor needs at least one piece to render: its own fallback piece is
 * a NEW object on every render (the id changes), so the card remounts
 * and any edit on it is lost. The provider therefore keeps ONE STABLE
 * piece per empty option and hands it to the editor — WITHOUT storing
 * it in the option (the option stays empty, so the backend drops it and
 * a half-built scenario is never quoted at $0).
 *
 * The registry is a plain closure (no React) so the provider can hold
 * it in a ref and keep the SAME piece identity across renders.
 */
import type { BudgetOption, BudgetPiece } from '../../../types/budget';
import { createEmptyOptionPieces } from './budgetOptions';

export interface GhostPiecesRegistry {
  /** The stable ghost piece(s) of an empty option. */
  ghostFor: (optionId: string) => BudgetPiece[];
  /** The pieces the editor must show for an option: its own, or the
   *  stable ghost while the option is still empty. */
  editorPiecesFor: (option: BudgetOption) => BudgetPiece[];
}

export function createGhostPiecesRegistry(): GhostPiecesRegistry {
  const ghosts = new Map<string, BudgetPiece[]>();

  const ghostFor = (optionId: string): BudgetPiece[] => {
    const existing = ghosts.get(optionId);
    if (existing && existing.length > 0) return existing;
    const created = createEmptyOptionPieces();
    ghosts.set(optionId, created);
    return created;
  };

  const editorPiecesFor = (option: BudgetOption): BudgetPiece[] =>
    option.pieces.length > 0 ? option.pieces : ghostFor(option.id);

  return { ghostFor, editorPiecesFor };
}
