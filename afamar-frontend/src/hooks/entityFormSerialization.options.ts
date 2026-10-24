/**
 * Loading the multi-OPTION scenarios of a budget from the API.
 *
 * Split out of `entityFormSerialization.ts` (which stays the public
 * barrel) so the `options_data` hydration lives next to the pieces
 * hydration it mirrors.
 */

import {
  parseOptions,
  resolveActiveOptionId,
} from '@features/budgets/options/budgetOptions';
import type { BudgetOption, BudgetPiece } from '../types/budget';
import { hydratePiecesSnapshots } from './entityForm/piecesHydration';

/**
 * Multi-option budgets (2026-10-01 Fase 2) — hydrate `options` /
 * `active_option_id` from the API's `options_data`.
 *
 * A budget saved before the migration has `options_data` NULL → `options`
 * stays `[]` and `pieces` (from `pieces_data`) stands alone, so the form
 * looks exactly as it did. A budget with options gets them parsed AND
 * hydrated through the same snapshot pipeline as `pieces_data`, so the
 * COMPARATIVA DE MEDICIÓN keeps working inside every option.
 *
 * The ACTIVE option's pieces are mirrored into the top-level `pieces`
 * so every legacy consumer (totals, PDF, pieces editor) reads the
 * option being edited without knowing options exist.
 */
export function loadOptions(
  d: Record<string, unknown>,
  fallbackPieces: BudgetPiece[],
): { options: BudgetOption[]; active_option_id: string; pieces: BudgetPiece[] } {
  const options = parseOptions(d.options_data);
  if (options.length === 0) {
    // Legacy budget → inert options, `pieces` untouched.
    return { options: [], active_option_id: '', pieces: fallbackPieces };
  }
  // Hydrate each option's pieces so measurement snapshots survive.
  const hydrated = options.map((o) => ({
    ...o,
    pieces: hydratePiecesSnapshots(d, o.pieces),
  }));
  const activeId = resolveActiveOptionId(hydrated, '');
  const active = hydrated.find((o) => o.id === activeId) ?? hydrated[0];
  return {
    options: hydrated,
    active_option_id: activeId,
    // Mirror the active option's pieces so the legacy `pieces` consumers
    // (useBudgetCalculations / buildPdfData / PiecesSection) read the
    // option being edited. The pools mirror follows from it.
    pieces: active.pieces,
  };
}
