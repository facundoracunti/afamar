import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { EntityFormState } from '../../../types/form';
import type { BudgetOption, BudgetPiece } from '../../../types/budget';
import { flattenPieces } from '../utils/pieces';
import { computeOptionSubtotal } from '@/utils/pdf/buildPdfData.alternatives';
import {
  clonePieces,
  isMultiOption,
  nextOptionId,
  nextOptionName,
  resolveActiveOptionId,
} from './budgetOptions';

interface BudgetOptionsValue {
  /** Every real option. Empty for a legacy single-option budget. */
  options: BudgetOption[];
  /** Id being edited ('' = legacy budget → `form.pieces` stands alone). */
  activeOptionId: string;
  /** True when there is more than one option → the UI shows the tabs. */
  isMultiOption: boolean;
  /** Pieces of the active option (what `form.pieces` mirrors). */
  activePieces: BudgetPiece[];
  setActiveOptionId: (id: string) => void;
  /** Append an empty option and activate it. */
  addOption: () => void;
  /** Deep-clone an option (fresh piece ids) and activate the copy. */
  duplicateOption: (id: string) => void;
  removeOption: (id: string) => void;
  /** Rename an option. */
  renameOption: (id: string, name: string) => void;
  /** Mark the option the conversion will use (the "ganadora"). */
  selectOption: (id: string) => void;
  /**
   * Write the ACTIVE option's pieces back into the options array. The
   * pieces hook calls this after any edit so the mirror never goes
   * stale. The reference is compared so a no-op commit is a no-op.
   */
  syncActivePieces: (pieces: BudgetPiece[]) => void;
  /**
   * Subtotal of EVERY option, in the document's native buckets.
   *
   * Computed with `computeOptionSubtotal` — the SAME helper the PDF's
   * "Resumen Comparativo de Opciones" uses — so the amount the operator
   * sees on the tab is exactly the amount the customer is quoted. Any
   * drift between the form and the PDF becomes impossible by
   * construction.
   */
  optionSubtotals: { id: string; ars: number; usd: number }[];
}

const BudgetOptionsContext = createContext<BudgetOptionsValue | null>(null);

/**
 * Write a pieces array into the form AND re-derive the legacy flat arrays
 * (`materials_data` / `fabrication_details` / `additional_works_data` /
 * `pools_data`) from it.
 *
 * WHY THIS MUST BE ATOMIC (2026-10-01, bugfix): the flat arrays are what
 * the totals (`useBudgetCalculations`), the document-level PDF blocks and
 * the backend recalc read. Mirroring `form.pieces` WITHOUT re-flattening
 * left the flats pointing at the PREVIOUS option, so the operator saw the
 * wrong scenario's amounts in the form while the PDF priced the right one
 * — the two never matched. Every write of `form.pieces` that is not
 * produced by the pieces hook's own `commit` MUST go through here.
 */
function withPieces(
  prev: EntityFormState,
  pieces: BudgetPiece[],
): EntityFormState {
  return { ...prev, pieces, ...flattenPieces(pieces) };
}

/** Read the budget-options context. Returns `null` outside a provider
 *  (e.g. a work order form, which has no options). */
export function useBudgetOptions(): BudgetOptionsValue | null {
  return useContext(BudgetOptionsContext);
}

export interface BudgetOptionsProviderProps {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  children: React.ReactNode;
}

/**
 * Owns the multi-option state and keeps `form.pieces` MIRRORING the
 * active option.
 *
 * The mirror is what makes this migration safe: every existing consumer
 * (`useBudgetCalculations`, `buildPdfData`, `PiecesSection`, the payment
 * panel) keeps reading `form.pieces` and therefore keeps working, while
 * the options array is the real source of truth. On every commit the
 * active option's pieces are written back, so switching tabs never shows
 * stale data.
 *
 * A legacy budget (`options: []`) is completely inert here: the tabs stay
 * hidden and `form.pieces` flows straight through.
 */
export function BudgetOptionsProvider({
  form,
  setForm,
  children,
}: BudgetOptionsProviderProps) {
  const options = form.options ?? [];
  const usdRate = Number(form.usd_rate) || 0;
  // Resolve the active id defensively so a stale `active_option_id`
  // (option deleted in another tab) can't strand the editor.
  const activeOptionId = resolveActiveOptionId(options, form.active_option_id ?? '');
  const isMulti = isMultiOption(options);

  // ── Mirror: pull the active option's pieces into `form.pieces` ──
  // Runs on tab switch / option list change only (NOT on every pieces
  // edit — that would fight the pieces hook, which owns `form.pieces`
  // while editing). `syncActivePieces` pushes edits the other way.
  //
  // The write goes through `withPieces` so the legacy flat arrays are
  // re-derived from the NEW option — otherwise the form's totals kept
  // showing the previously-active option's amounts.
  const lastSyncedId = useRef<string>('');
  useEffect(() => {
    if (options.length === 0) return;
    if (lastSyncedId.current === activeOptionId) return;
    lastSyncedId.current = activeOptionId;
    const option = options.find((o) => o.id === activeOptionId);
    if (!option) return;
    // Only replace when they actually differ, otherwise switching away
    // and back would rewrite the array reference and drop any pending
    // local state in the pieces editor.
    setForm((prev) => {
      if (prev.pieces === option.pieces) return prev;
      return withPieces(prev, option.pieces);
    });
  }, [options, activeOptionId, setForm]);

  const setActiveOptionId = useCallback(
    (id: string) => {
      setForm((prev) => {
        const list = prev.options ?? [];
        const target = list.find((o) => o.id === id);
        // Atomic switch: the active id AND the pieces AND the flat arrays
        // move together, so no consumer can ever observe a half-applied
        // tab switch (the pieces of one option with the totals of
        // another).
        if (!target) return { ...prev, active_option_id: id };
        return {
          ...withPieces(prev, target.pieces),
          active_option_id: id,
        };
      });
    },
    [setForm],
  );

  const addOption = useCallback(() => {
    setForm((prev) => {
      const list = prev.options ?? [];

      // Case A — the budget has NO materialised option yet (a new budget, or
      // a legacy budget that only carries `pieces`). Materialise the current
      // configuration as "Opción 1" and add a CLONE of it as "Opción 2", so
      // the operator can change just one material (e.g. swap the alzada to
      // Blanco Zen Mate) without rewriting the whole job.
      if (list.length === 0) {
        const firstId = 'opt-1';
        const secondId = 'opt-2';
        const basePieces = prev.pieces ?? [];
        const cloned = clonePieces(basePieces);
        return {
          ...withPieces(prev, cloned),
          options: [
            {
              id: firstId,
              name: 'Opción 1',
              is_selected: true,
              pieces: basePieces,
            },
            {
              id: secondId,
              name: 'Opción 2',
              is_selected: false,
              pieces: cloned,
            },
          ],
          active_option_id: secondId,
        };
      }

      // Case B — options already exist: clone the ACTIVE one (the
      // configuration the operator is looking at right now).
      const activeId = resolveActiveOptionId(list, prev.active_option_id ?? '');
      const source = list.find((o) => o.id === activeId) ?? list[0];
      const id = nextOptionId(list);
      const copy: BudgetOption = {
        id,
        name: nextOptionName(list),
        // A new option is never the winner until the operator says so.
        is_selected: false,
        pieces: clonePieces(source.pieces),
      };
      const nextList = [...list, copy];
      return {
        ...withPieces(prev, copy.pieces),
        options: nextList,
        active_option_id: id,
      };
    });
  }, [setForm]);

  const duplicateOption = useCallback(
    (id: string) => {
      setForm((prev) => {
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
      });
    },
    [setForm],
  );

  const removeOption = useCallback(
    (id: string) => {
      setForm((prev) => {
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
      });
    },
    [setForm],
  );

  const renameOption = useCallback(
    (id: string, name: string) => {
      setForm((prev) => ({
        ...prev,
        options: (prev.options ?? []).map((o) =>
          o.id === id ? { ...o, name } : o,
        ),
      }));
    },
    [setForm],
  );

  const selectOption = useCallback(
    (id: string) => {
      setForm((prev) => ({
        ...prev,
        options: (prev.options ?? []).map((o) =>
          o.id === id ? { ...o, is_selected: true } : { ...o, is_selected: false },
        ),
      }));
    },
    [setForm],
  );

  /**
   * Push the pieces being edited back into the active option. Called by
   * the pieces hook after every commit. The reference check keeps it a
   * no-op when the pieces did not actually change (avoids a re-render
   * loop, since `pieces` is recreated on each render).
   */
  const syncActivePieces = useCallback(
    (pieces: BudgetPiece[]) => {
      setForm((prev) => {
        if (!prev.options || prev.options.length === 0) return prev;
        const id = resolveActiveOptionId(prev.options, prev.active_option_id ?? '');
        const option = prev.options.find((o) => o.id === id);
        if (!option || option.pieces === pieces) return prev;
        return {
          ...prev,
          options: prev.options.map((o) => (o.id === id ? { ...o, pieces } : o)),
        };
      });
    },
    [setForm],
  );

  /**
   * Per-option subtotals, priced with the PDF's own helper so the tab
   * bar and the comparative summary always show the SAME numbers.
   */
  const optionSubtotals = useMemo(
    () =>
      options.map((o) => {
        const { ars, usd } = computeOptionSubtotal(o.pieces, usdRate);
        return { id: o.id, ars, usd };
      }),
    [options, usdRate],
  );

  const value = useMemo<BudgetOptionsValue>(
    () => ({
      options,
      activeOptionId,
      isMultiOption: isMulti,
      activePieces: form.pieces ?? [],
      setActiveOptionId,
      addOption,
      duplicateOption,
      removeOption,
      renameOption,
      selectOption,
      syncActivePieces,
      optionSubtotals,
    }),
    [
      options,
      activeOptionId,
      isMulti,
      form.pieces,
      setActiveOptionId,
      addOption,
      duplicateOption,
      removeOption,
      renameOption,
      selectOption,
      syncActivePieces,
      optionSubtotals,
    ],
  );

  return (
    <BudgetOptionsContext.Provider value={value}>
      {children}
    </BudgetOptionsContext.Provider>
  );
}