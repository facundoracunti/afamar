/**
 * Multi-option (multi-escenario) budgets — frontend logic layer.
 *
 * 2026-10-01, Fase 2 of the "Opciones / Escenarios Independientes"
 * migration. Mirrors the backend contract in
 * `afamar-backend/app/services/budget_options.py` exactly (same ids, same
 * `SINGLE_OPTION_ID`, same "drop empty options" rule) so the form, the
 * totals and the PDF always agree with what the API stores.
 *
 * `pieces` on the form mirrors the ACTIVE option (kept in sync by
 * `BudgetOptionsProvider`), so every legacy consumer — `useBudgetCalculations`,
 * `buildPdfData`, `PiecesSection` — keeps reading `form.pieces` and needs
 * no branch. This module owns the translation between that mirror and the
 * real `options[]` array.
 */
import type { BudgetOption, BudgetPiece } from '../../../types/budget';
import { SINGLE_OPTION_ID, SINGLE_OPTION_NAME } from '../../../types/budget';
import { createEmptyPiece } from '../utils/pieces';

/** Parse a `pieces_data`-shaped payload (JSON string | list | null) →
 *  list of piece dicts. Mirrors the backend's tolerant parsing. */
export function parsePieces(raw: unknown): BudgetPiece[] {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw.filter((p): p is BudgetPiece => !!p && typeof p === 'object');
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is BudgetPiece => !!p && typeof p === 'object')
      : [];
  } catch {
    return [];
  }
}

/** Serialise pieces for the `pieces_data` / `options_data` TEXT column. */
export function serializePieces(pieces: BudgetPiece[] | null | undefined): string | null {
  if (!pieces || pieces.length === 0) return null;
  return JSON.stringify(pieces);
}

/** Normalise one raw option; `null` when it has no usable pieces (an empty
 *  option would convert to an empty work order, so it is never surfaced). */
export function normalizeOption(raw: unknown, index: number): BudgetOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const pieces = parsePieces(obj.pieces);
  if (pieces.length === 0) return null;
  return {
    id: String(obj.id ?? `opt-${index + 1}`),
    name: String(obj.name ?? `Opción ${index + 1}`),
    is_selected: obj.is_selected === true,
    pieces,
  };
}

/** The budget's real options, or `[]` for a legacy single-option budget.
 *  A stored option list that is empty/corrupt answers `[]` so the caller
 *  falls back to the legacy path instead of hiding the real configuration. */
export function parseOptions(raw: unknown): BudgetOption[] {
  if (raw == null || raw === '') return [];
  let candidate: unknown = raw;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(candidate)) return [];
  const out: BudgetOption[] = [];
  candidate.forEach((r, i) => {
    const option = normalizeOption(r, i);
    if (option) out.push(option);
  });
  return out;
}

/** The pieces the form is currently editing:
 *  - multi-option budget → the ACTIVE option's pieces (or the selected
 *    one, or the first, so the editor is never empty),
 *  - legacy budget → `form.pieces` as-is. */
export function activePieces(
  options: BudgetOption[],
  activeOptionId: string,
  legacyPieces: BudgetPiece[],
): BudgetPiece[] {
  if (!options || options.length === 0) return legacyPieces;
  const found =
    (activeOptionId ? options.find((o) => o.id === activeOptionId) : undefined) ??
    options.find((o) => o.is_selected) ??
    options[0];
  return found?.pieces ?? legacyPieces;
}

/** The option id that should be active on open: the explicitly stored one,
 *  else the selected, else the first. Empty string for a legacy budget. */
export function resolveActiveOptionId(
  options: BudgetOption[],
  storedActiveId: string,
): string {
  if (!options || options.length === 0) return '';
  if (storedActiveId && options.some((o) => o.id === storedActiveId)) {
    return storedActiveId;
  }
  const selected = options.find((o) => o.is_selected);
  return (selected ?? options[0]).id;
}

/** True when the budget has more than one real option → drives the tabs.
 *  A legacy budget answers false, so the UI keeps its current look. */
export function isMultiOption(options: BudgetOption[]): boolean {
  return Array.isArray(options) && options.length > 1;
}

/** Next free option number, so labels stay sequential ("Opción 3"). */
export function nextOptionName(options: BudgetOption[]): string {
  let n = options.length + 1;
  const taken = new Set(options.map((o) => o.name));
  while (taken.has(`Opción ${n}`)) n += 1;
  return `Opción ${n}`;
}

/** Next free option id (`opt-N`), stable across renames. */
export function nextOptionId(options: BudgetOption[]): string {
  let n = options.length + 1;
  const taken = new Set(options.map((o) => o.id));
  while (taken.has(`opt-${n}`)) n += 1;
  return `opt-${n}`;
}

/** Clone an option's pieces with FRESH ids so editing the copy never
 *  mutates the original's piece ids (the pieces tree is keyed by id in
 * the form and by `key` in React). */
export function clonePieces(pieces: BudgetPiece[]): BudgetPiece[] {
  const clonePiece = (p: BudgetPiece): BudgetPiece => ({
    ...p,
    id: `${p.id}-copy-${Math.random().toString(36).slice(2, 8)}`,
    mainMaterial: p.mainMaterial ? { ...p.mainMaterial } : null,
    mainMaterialRows: (p.mainMaterialRows ?? []).map((r) => ({ ...r })),
    alternativeMaterials: (p.alternativeMaterials ?? []).map((a) => ({ ...a })),
    fabrication_details: (p.fabrication_details ?? []).map((f) => ({ ...f })),
    additional_works_data: p.additional_works_data ?? '[]',
    pools: (p.pools ?? []).map((pool) => ({ ...pool })),
  });
  return pieces.map(clonePiece);
}

/** A brand-new option with NO content yet — the operator builds the
 *  scenario from scratch.
 *
 *  `pieces: []` is deliberate: an option without a piece is dropped by
 *  the backend (`_normalize_option`) and never reaches the customer's
 *  comparative, so a half-built scenario can never be quoted at $0.
 *  To CLONE an existing option the operator uses the tab's ❐ button
 *  (`duplicateOption`), which copies pieces, measures and piletas. */
export function createEmptyOption(id: string, name: string): BudgetOption {
  return { id, name, is_selected: false, pieces: [] };
}

/** The piece the editor shows while an option is still empty.
 *
 *  The pieces editor draws its OWN fallback piece when the list is empty,
 *  but that fallback is a NEW object on every render (its id changes), so
 *  the card remounts and any edit on it is lost. The provider therefore
 *  keeps ONE STABLE piece per empty option and hands it to the editor —
 *  without storing it in the option (the option stays `pieces: []`). */
export function createEmptyOptionPieces(): BudgetPiece[] {
  return [createEmptyPiece(0)];
}

/** True when a piece carries NO billable content (no material, no
 *  alternative, no zócalo/frente, no additional works, no pileta).
 *
 *  Such a piece is the "ghost" of an empty option: it must NEVER be
 *  pushed into the option, or the option would be persisted as a
 *  material-less scenario and quoted at $0 (the defect documented for
 *  the "ghost piece" bug of 2026-10-01). */
export function isContentlessPiece(piece: BudgetPiece): boolean {
  return (
    !piece.mainMaterial &&
    (piece.alternativeMaterials || []).length === 0 &&
    (piece.fabrication_details || []).length === 0 &&
    (piece.pools || []).length === 0 &&
    (!piece.additional_works_data || piece.additional_works_data === '[]')
  );
}

/** The option a conversion would use, or `null` when ambiguous. Mirrors
 *  the backend `pick_winning_option`: an explicit id wins, then a single
 *  `is_selected`, then a single available option (legacy). With several
 *  options and no clear winner it returns `null` — converting the wrong
 *  option bills the wrong price AND deducts the wrong sink. */
export function pickWinningOptionId(
  options: BudgetOption[],
  explicitId?: string | null,
): string | null {
  if (!options || options.length === 0) return SINGLE_OPTION_ID;
  if (explicitId && options.some((o) => o.id === explicitId)) return explicitId;
  const selected = options.filter((o) => o.is_selected);
  if (selected.length === 1) return selected[0].id;
  if (options.length === 1) return options[0].id;
  return null;
}

export { SINGLE_OPTION_ID, SINGLE_OPTION_NAME };