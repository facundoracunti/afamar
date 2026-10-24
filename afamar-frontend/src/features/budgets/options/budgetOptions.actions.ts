/**
 * PURE state transitions of a multi-option budget.
 *
 * Each `apply*` function receives the previous form state and returns
 * the NEXT one — no React, no side effects — so the provider only has
 * to wire them to `setForm` and the rules stay unit-testable.
 *
 * Every transition that touches `form.pieces` goes through `withPieces`
 * so the legacy flat arrays are re-derived atomically with the pieces
 * (see `budgetOptions.pieces.ts`).
 */
import type { EntityFormState } from '../../../types/form';
import type { BudgetOption, BudgetPiece } from '../../../types/budget';
import {
  clonePieces,
  createEmptyOption,
  nextOptionId,
  nextOptionName,
  resolveActiveOptionId,
} from './budgetOptions';
import { withPieces } from './budgetOptions.pieces';

/** Resolves the stable ghost pieces of an empty option. */
export type GhostResolver = (optionId: string) => BudgetPiece[];
/** Resolves the pieces the editor must show for an option. */
export type EditorPiecesResolver = (option: BudgetOption) => BudgetPiece[];

/**
 * Switch the edited option. The active id AND the pieces AND the flat
 * arrays move together, so no consumer can ever observe a half-applied
 * tab switch (the pieces of one option with the totals of another).
 */
export function applySetActiveOption(
  prev: EntityFormState,
  id: string,
  editorPiecesFor: EditorPiecesResolver,
): EntityFormState {
  const list = prev.options ?? [];
  const target = list.find((o) => o.id === id);
  if (!target) return { ...prev, active_option_id: id };
  return {
    ...withPieces(prev, editorPiecesFor(target)),
    active_option_id: id,
  };
}

/**
 * Append a NEW option and activate it.
 *
 * ── Case A — the budget has NO materialised option yet (a new budget,
 * or a legacy budget that only carries `pieces`). The current
 * configuration must NOT be lost: it is materialised as "Opción 1" and
 * the NEW option is added EMPTY, so the operator can build a scenario
 * from scratch.
 *
 * ── Case B — options already exist: append an EMPTY option. The
 * operator builds the scenario from scratch; to CLONE the current
 * configuration (measures, pieces and piletas) they use the ❐ button of
 * the tab, which is the explicit "duplicate" action.
 */
export function applyAddOption(
  prev: EntityFormState,
  ghostFor: GhostResolver,
): EntityFormState {
  const list = prev.options ?? [];

  if (list.length === 0) {
    const basePieces = prev.pieces ?? [];
    // Nothing to preserve (brand-new budget): a single empty option is
    // enough — there is no "Opción 1" configuration to keep.
    if (basePieces.length === 0) {
      const empty = createEmptyOption('opt-1', 'Opción 1');
      return {
        ...withPieces(prev, ghostFor(empty.id)),
        options: [{ ...empty, is_selected: true }],
        active_option_id: empty.id,
      };
    }
    const empty = createEmptyOption('opt-2', 'Opción 2');
    return {
      ...withPieces(prev, ghostFor(empty.id)),
      options: [
        {
          id: 'opt-1',
          name: 'Opción 1',
          is_selected: true,
          pieces: basePieces,
        },
        empty,
      ],
      active_option_id: empty.id,
    };
  }

  const empty = createEmptyOption(nextOptionId(list), nextOptionName(list));
  const nextList = [...list, empty];
  // Keep exactly one winner: if the stored list had none, promote the
  // first one so a conversion is never left ambiguous.
  if (!nextList.some((o) => o.is_selected)) {
    nextList[0] = { ...nextList[0], is_selected: true };
  }
  return {
    ...withPieces(prev, ghostFor(empty.id)),
    options: nextList,
    active_option_id: empty.id,
  };
}

/** Deep-clone an option (fresh piece ids) and activate the copy. */
export function applyDuplicateOption(
  prev: EntityFormState,
  id: string,
): EntityFormState {
  const list = prev.options ?? [];
  const source = list.find((o) => o.id === id);
  if (!source) return prev;
  const newId = nextOptionId(list);
  const copy: BudgetOption = {
    id: newId,
    name: nextOptionName(list),
    // A duplicate is never the winner until the operator says so.
    is_selected: false,
    pieces: clonePieces(source.pieces),
  };
  return {
    ...withPieces(prev, copy.pieces),
    options: [...list, copy],
    active_option_id: newId,
  };
}

/** Remove an option, keeping exactly one winner among the survivors. */
export function applyRemoveOption(
  prev: EntityFormState,
  id: string,
): EntityFormState {
  const list = prev.options ?? [];
  if (list.length <= 1) return prev; // never leave zero options stored
  const next = list.filter((o) => o.id !== id);
  // Keep exactly one winner: if we removed the selected one and a
  // survivor exists, promote the first.
  if (next.length > 0 && !next.some((o) => o.is_selected)) {
    next[0] = { ...next[0], is_selected: true };
  }
  // The removed option may have been the active one — the editor
  // must show a SURVIVOR's pieces (and its totals), never the
  // deleted scenario.
  const nextActiveId =
    prev.active_option_id === id ? next[0]?.id ?? '' : prev.active_option_id;
  const target = next.find((o) => o.id === nextActiveId);
  const base = target
    ? withPieces(prev, target.pieces)
    : { ...prev, pieces: [] };
  return {
    ...base,
    options: next,
    active_option_id: nextActiveId,
  };
}

/** Rename an option. */
export function applyRenameOption(
  prev: EntityFormState,
  id: string,
  name: string,
): EntityFormState {
  return {
    ...prev,
    options: (prev.options ?? []).map((o) =>
      o.id === id ? { ...o, name } : o,
    ),
  };
}

/** Mark the option the conversion will use (the "ganadora"). */
export function applySelectOption(
  prev: EntityFormState,
  id: string,
): EntityFormState {
  return {
    ...prev,
    options: (prev.options ?? []).map((o) =>
      o.id === id ? { ...o, is_selected: true } : { ...o, is_selected: false },
    ),
  };
}

/**
 * Push the pieces being edited back into the active option. The
 * reference check keeps it a no-op when the pieces did not actually
 * change (avoids a re-render loop, since `pieces` is recreated on each
 * render).
 */
export function applySyncActivePieces(
  prev: EntityFormState,
  pieces: BudgetPiece[],
): EntityFormState {
  if (!prev.options || prev.options.length === 0) return prev;
  const id = resolveActiveOptionId(prev.options, prev.active_option_id ?? '');
  const option = prev.options.find((o) => o.id === id);
  if (!option || option.pieces === pieces) return prev;
  return {
    ...prev,
    options: prev.options.map((o) => (o.id === id ? { ...o, pieces } : o)),
  };
}
