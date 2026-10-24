/**
 * Composable: CRUD for the multi-piece (`pieces_data`) budget flow.
 *
 * Pieces v3 (pieces-only mode, the default everywhere in the app):
 * each piece owns exactly one main material, a list of alternative
 * materials, its own zócalo/frente rows, its own additional works AND
 * its own piletas. The "Alternativa" checkbox on a material cleanly
 * moves the row between the main and alternatives arrays without
 * touching the other one. Piletas previously lived in a global
 * `form.pools_data`; they now live inside the piece they belong to so a
 * "Mesada Cocina" and a "Mesada Baño" can each carry their own sink.
 *
 * Every mutation writes the `pieces` array AND re-flattens it into the
 * legacy document-level arrays (`materials_data`, `fabrication_details`,
 * `additional_works_data`, `pools_data`) in the SAME state update so the
 * rest of the form (totals / card surcharge / cash / backend recalc)
 * keeps reading the flat arrays unchanged.
 *
 * This file is a thin orchestrator: the atomic commit lives in
 * `useBudgetPieces.commit.ts`, the catalogue in
 * `useBudgetPieces.catalogue.ts` and every group of handlers in its own
 * `useBudgetPieces.handlers.*.ts` module. The pure mutators they call
 * live in `useBudgetPieces.helpers.ts` (which re-exports the focused
 * `useBudgetPieces.helpers.*` modules). The contract
 * (`UseBudgetPiecesParams` / `UseBudgetPiecesReturn`) lives in
 * `useBudgetPieces.types.ts` and is re-exported here so consumers keep
 * importing from this same path.
 */
import { useEffect } from 'react';
import { createEmptyPiece } from '@features/budgets/utils/pieces';
import { resolveActiveOptionId, isContentlessPiece } from '@features/budgets/options/budgetOptions';
import { useFrontCatalogue } from './useBudgetPieces.catalogue';
import { usePiecesCommit } from './useBudgetPieces.commit';
import { usePieceHandlers } from './useBudgetPieces.handlers.pieces';
import { useMainMaterialHandlers } from './useBudgetPieces.handlers.materials';
import { useAlternativeMaterialHandlers } from './useBudgetPieces.handlers.alternatives';
import { useWorksHandlers } from './useBudgetPieces.handlers.works';
import { usePoolHandlers } from './useBudgetPieces.handlers.pools';
import type { UseBudgetPiecesParams, UseBudgetPiecesReturn } from './useBudgetPieces.types';

export type { UseBudgetPiecesParams, UseBudgetPiecesReturn } from './useBudgetPieces.types';

export function useBudgetPieces({
  form,
  setForm,
  materials,
}: UseBudgetPiecesParams): UseBudgetPiecesReturn {
  const { catalogueById } = useFrontCatalogue();
  const commit = usePiecesCommit(setForm);

  // Multi-option budgets (2026-10-01 Fase 2): push the edited pieces
  // into the ACTIVE option so switching tabs never loses work. Written
  // inline (no context dependency) to keep this hook usable outside a
  // `BudgetOptionsProvider` (work orders) — the guard below makes it a
  // no-op when the budget has no options.
  //
  // NEVER push an EMPTY pieces array (2026-10-01 bugfix): `form.pieces`
  // may momentarily be empty while the provider swaps tabs, and the
  // editor renders a GHOST piece (`createEmptyPiece`) for that empty
  // state. Persisting the ghost would replace the option's real pieces
  // with a material-less piece — the option then priced at $0 in the
  // PDF (only its traforos survived).
  //
  // The same rule applies to a brand-new EMPTY option (2026-10-24): it
  // is edited through a stable ghost piece that lives only in the editor
  // state, so the push waits until that piece carries real content —
  // otherwise the option would be persisted as a material-less scenario
  // (and quoted at $0 in the customer's comparative).
  useEffect(() => {
    const list = form.options;
    if (!list || list.length === 0) return;
    if (!form.pieces || form.pieces.length === 0) return;
    const activeId =
      resolveActiveOptionId(list, form.active_option_id ?? '') || '';
    const option = list.find((o) => o.id === activeId);
    if (!option || option.pieces === form.pieces) return;
    if (option.pieces.length === 0 && form.pieces.every(isContentlessPiece)) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      options: (prev.options ?? []).map((o) =>
        o.id === activeId ? { ...o, pieces: prev.pieces } : o,
      ),
    }));
  }, [form.pieces, form.options, form.active_option_id, setForm]);

  const pieces = form.pieces && form.pieces.length > 0
    ? form.pieces
    : [createEmptyPiece(0)];

  const pieceHandlers = usePieceHandlers(commit);
  const mainMaterialHandlers = useMainMaterialHandlers({
    commit,
    form,
    materials,
    catalogueById,
  });
  const alternativeMaterialHandlers = useAlternativeMaterialHandlers({
    commit,
    form,
    materials,
    catalogueById,
  });
  const worksHandlers = useWorksHandlers({ commit, materials });
  const poolHandlers = usePoolHandlers(commit);

  return {
    pieces,
    ...pieceHandlers,
    ...mainMaterialHandlers,
    ...alternativeMaterialHandlers,
    ...worksHandlers,
    ...poolHandlers,
  };
}
