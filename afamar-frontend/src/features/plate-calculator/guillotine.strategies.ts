import type { GuillotineResult, Item, PackAction, PackHeuristic } from './guillotine.types';

/**
 * Ordering strategies tried by the multi-pass packer. Each sorts the SAME item
 * list and runs a full sequence; ties between layouts are broken by the order
 * of this array (a heuristic that appears earlier wins).
 */

/** Deterministic heuristic order: "area" is the tie-breaker default. */
export const HEURISTIC_ORDER: PackHeuristic[] = [
  'area',
  'longerSide',
  'perimeter',
  'width',
  'height',
  'shortSide',
];

/**
 * Stable sort of a COPY of the items under one heuristic. Rank keys only; the
 * original relative order (notably the tramo order of an auto-split piece) is
 * preserved among items with equal keys because `Array.prototype.sort` is
 * stable (ES2019+).
 */
export function sortItems(items: Item[], heuristic: PackHeuristic): Item[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (heuristic) {
      case 'area':
        return b.fw * b.fh - a.fw * a.fh;
      case 'longerSide':
        return Math.max(b.fw, b.fh) - Math.max(a.fw, a.fh);
      case 'perimeter':
        return b.fw + b.fh - (a.fw + a.fh);
      case 'width':
        return b.fw - a.fw;
      case 'height':
        return b.fh - a.fh;
      case 'shortSide':
        return Math.min(b.fw, b.fh) - Math.min(a.fw, a.fh);
    }
  });
  return sorted;
}

/**
 * Nominal area left unplaced (square meters). Primary quality metric of a
 * layout: the winning layout unplaces the least area possible.
 */
export function unplacedArea(unplaced: PackAction[]): number {
  return unplaced.reduce((s, u) => s + u.largo * u.ancho, 0);
}

/**
 * Chooses the better of two candidate layouts: fewer unplaced area first,
 * then fewer plates, then higher utilization. Exact ties keep the previous
 * one, so the earlier heuristic in HEURISTIC_ORDER wins deterministically.
 */
export function better(
  prev: GuillotineResult | null,
  candidate: GuillotineResult,
): GuillotineResult {
  if (prev === null) return candidate;
  if (unplacedArea(candidate.unplaced) < unplacedArea(prev.unplaced))
    return candidate;
  if (unplacedArea(candidate.unplaced) > unplacedArea(prev.unplaced))
    return prev;
  if (candidate.platesNeeded < prev.platesNeeded) return candidate;
  if (candidate.platesNeeded > prev.platesNeeded) return prev;
  if (candidate.utilizationPct > prev.utilizationPct) return candidate;
  return prev;
}
