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
import { computeOptionSubtotal } from '@/utils/pdf/buildPdfData.alternatives';
import {
  isMultiOption,
  resolveActiveOptionId,
} from './budgetOptions';
import { withPieces } from './budgetOptions.pieces';
import { createGhostPiecesRegistry } from './budgetOptions.ghost';
import type { GhostPiecesRegistry } from './budgetOptions.ghost';
import {
  applyAddOption,
  applyDuplicateOption,
  applyRemoveOption,
  applyRenameOption,
  applySelectOption,
  applySetActiveOption,
  applySyncActivePieces,
} from './budgetOptions.actions';

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
  /** Append an EMPTY option and activate it (the operator builds the
   *  scenario from scratch). */
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
 *
 * The RULES live in pure modules next to this file:
 *   - `budgetOptions.actions.ts` → the state transitions (pure).
 *   - `budgetOptions.ghost.ts`   → the stable ghost piece of an empty
 *                                  option.
 *   - `budgetOptions.pieces.ts`   → the atomic pieces + flat write.
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

  // ── Ghost piece of an EMPTY option ──────────────────────────────────
  // The registry keeps ONE STABLE piece per empty option (see
  // `budgetOptions.ghost.ts`); it lives in a ref so the piece identity
  // survives every render.
  const ghostsRef = useRef<GhostPiecesRegistry | null>(null);
  if (ghostsRef.current === null) {
    ghostsRef.current = createGhostPiecesRegistry();
  }
  const ghosts = ghostsRef.current;

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
      const pieces = ghosts.editorPiecesFor(option);
      if (prev.pieces === pieces) return prev;
      return withPieces(prev, pieces);
    });
  }, [options, activeOptionId, setForm, ghosts]);

  const setActiveOptionId = useCallback(
    (id: string) => {
      setForm((prev) => applySetActiveOption(prev, id, ghosts.editorPiecesFor));
    },
    [setForm, ghosts],
  );

  const addOption = useCallback(() => {
    setForm((prev) => applyAddOption(prev, ghosts.ghostFor));
  }, [setForm, ghosts]);

  const duplicateOption = useCallback(
    (id: string) => {
      setForm((prev) => applyDuplicateOption(prev, id));
    },
    [setForm],
  );

  const removeOption = useCallback(
    (id: string) => {
      setForm((prev) => applyRemoveOption(prev, id));
    },
    [setForm],
  );

  const renameOption = useCallback(
    (id: string, name: string) => {
      setForm((prev) => applyRenameOption(prev, id, name));
    },
    [setForm],
  );

  const selectOption = useCallback(
    (id: string) => {
      setForm((prev) => applySelectOption(prev, id));
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
      setForm((prev) => applySyncActivePieces(prev, pieces));
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
