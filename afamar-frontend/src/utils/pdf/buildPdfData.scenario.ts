/**
 * Multi-option SCENARIO resolution for the PDF payload.
 *
 * A budget with 2+ independent options has no single "document content":
 * each option carries its own pieces, materials, traforos and piletas. The
 * document therefore describes the WINNING option — the one a conversion
 * would turn into an orden de trabajo — so the TOTAL at the bottom of the
 * PDF always adds up to the pieces printed above it.
 */

import { flattenPieces } from '@features/budgets/utils/pieces';
import type { BudgetOption } from '../../types/budget';

/** The winning option of a multi-option budget (explicit selection first,
 *  then the active one, then the first created). `null` for a legacy /
 *  single-option budget. */
export function resolveWinnerOption(
  options: BudgetOption[],
  activeOptionId: unknown,
): BudgetOption | null {
  if (options.length === 0) return null;
  return (
    options.find((o) => o.is_selected) ??
    options.find((o) => o.id === (activeOptionId as string)) ??
    options[0]
  );
}

/**
 * The form slice the whole document is built from.
 *
 * The winner's pieces are re-flattened into the legacy arrays so EVERY
 * downstream reader (sections, additional works, pools, the discount base)
 * sees the same scenario. Without this the totals came from whichever
 * option the operator had open in the form while page 1 printed another
 * one — the two never matched.
 */
export function resolveEffectiveForm(
  form: Record<string, unknown>,
  winner: BudgetOption | null,
): Record<string, unknown> {
  return winner
    ? {
        ...form,
        pieces: winner.pieces,
        ...flattenPieces(winner.pieces),
      }
    : (form as unknown as Record<string, unknown>);
}

/** Scenario resolution in one shot: which option wins + the effective form. */
export function resolveScenario(form: Record<string, unknown>): {
  options: BudgetOption[];
  winner: BudgetOption | null;
  effectiveForm: Record<string, unknown>;
} {
  const options = (form.options ?? []) as BudgetOption[];
  const winner = resolveWinnerOption(options, form.active_option_id);
  return { options, winner, effectiveForm: resolveEffectiveForm(form, winner) };
}
