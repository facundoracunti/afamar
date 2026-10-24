/**
 * Guillotine bin-packing (2D) for stone/quartz plates.
 *
 * All positions are in meters (plate is plateW × plateH). The kerf (blade
 * width, in meters) is added to BOTH sides of every piece, so a piece of
 * nominal size (largo × ancho) occupies a footprint of
 * (largo + kerf*2) × (ancho + kerf*2) inside the plate. EXCEPTION: when a
 * dimension equals the full plate dimension along that axis (largo === plateW
 * or ancho === plateH) it spans the two FACTORY edges of the slab and NO kerf
 * is consumed there — the piece fits flush to length/width (the real workshop
 * behavior: a 3.00m piece in a 3.00m plate is never cut along its length).
 * Pieces may be rotated 90° when `allowRotation` is true (default).
 *
 * The algorithm uses a classic "free rectangles" guillotine split: each free
 * rectangle is split along its shorter remaining side so every cut spans the
 * full current free rect (edge-to-edge, horizontal or vertical — a real
 * guillotine cut). This guarantees:
 *   - every placed piece fits fully inside its plate (no overflow)
 *   - no two pieces overlap each other inside a plate
 *
 * Oversized pieces whose NOMINAL LARGO exceeds the plate length (and that do
 * not fit rotated either) are AUTO-SPLIT along the largo into tramos
 * ([plateW, plateW, ..., leftover]) and each tramo is packed independently —
 * e.g. a 4.10 × 0.62 mesada in a 3.00 × 1.40 plate becomes a 3.00 × 0.62
 * tramo plus a 1.10 × 0.62 tramo that slots into the leftover band. Split
 * tramos are flagged with `split` (tramo/total) on the placed/unplaced items.
 * Pieces that overflow only the ancho (too wide for the plate) are NOT split
 * and stay `unplaced`.
 *
 * The pack is a MULTI-PASS heuristic search: the same item list is sorted with
 * different strategies (area desc, longest-side first, perimeter, width,
 * height, shortest-side) and each ordering runs a full sequence; the layout
 * that minimizes unplaced area, then plate count, then waste wins ("area" wins
 * exact ties → deterministic). Free rectangles are MERGED after every
 * placement so a small piece can consolidate leftover slivers and slot into a
 * previous plate instead of opening a new (nearly empty) one.
 *
 * This file is the ORCHESTRATOR / public barrel of the engine: it runs the
 * multi-pass search and re-exports every public name, so consumers keep
 * importing from `guillotinePacker` exactly as before. The internals live in
 * focused modules:
 *   - `guillotine.types.ts`     → public + internal types
 *   - `guillotine.constants.ts` → shared numeric tolerances
 *   - `guillotine.items.ts`     → footprint / auto-split expansion
 *   - `guillotine.merge.ts`     → free-rect consolidation
 *   - `guillotine.placement.ts` → fit search + guillotine split
 *   - `guillotine.strategies.ts`→ ordering heuristics + layout comparison
 *   - `guillotine.sequence.ts`  → one full packing sequence
 */
import { buildItems } from './guillotine.items';
import { packSequence } from './guillotine.sequence';
import { HEURISTIC_ORDER, better, sortItems } from './guillotine.strategies';
import type { GuillotineResult, PackOptions, PackPieceInput } from './guillotine.types';

export type {
  GuillotineResult,
  PackAction,
  PackHeuristic,
  PackOptions,
  PackPieceInput,
  PlateLayout,
  PlacedPiece,
  SplitTramoInfo,
} from './guillotine.types';

export { HEURISTIC_ORDER } from './guillotine.strategies';

/**
 * Guillotine pack with MULTI-PASS heuristic search. Builds the item list once,
 * then runs a full sequence per ordering strategy in HEURISTIC_ORDER and
 * returns the BEST layout. Consumers are fully agnostic: the winning layout is
 * a single deterministic GuillotineResult (plates + unplaced + utilization),
 * the auto-split and no-overlap semantics are preserved.
 */
export function packGuillotine(
  pieces: PackPieceInput[],
  options: PackOptions,
): GuillotineResult {
  const { plateW, plateH } = options;
  const plateM2 = plateW * plateH;

  const items = buildItems(pieces, options);

  let best: GuillotineResult | null = null;
  for (const heuristic of HEURISTIC_ORDER) {
    const layout = packSequence(sortItems(items, heuristic), options, plateM2);
    best = better(best, layout);
  }
  return best as GuillotineResult;
}

/**
 * Pure no-overlap assertion (useful in tests): verifies that within each
 * plate no two placed pieces overlap and each stays inside the plate bounds.
 */
export function verifyNoOverlap(result: GuillotineResult): boolean {
  for (const plate of result.plates) {
    const W = result.plateW;
    const H = result.plateH;
    for (const p of plate.pieces) {
      if (p.x < -1e-9 || p.y < -1e-9) return false;
      if (p.x + p.w > W + 1e-9 || p.y + p.h > H + 1e-9) return false;
      for (const q of plate.pieces) {
        if (p === q) continue;
        const overlap =
          p.x < q.x + q.w - 1e-9 &&
          q.x < p.x + p.w - 1e-9 &&
          p.y < q.y + q.h - 1e-9 &&
          q.y < p.y + p.h - 1e-9;
        if (overlap) return false;
      }
    }
  }
  return true;
}
