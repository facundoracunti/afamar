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
 */
export interface PackPieceInput {
  id: number;
  nombre?: string;
  largo: number;
  ancho: number;
  cantidad: number;
}

export interface PackOptions {
  plateW: number;
  plateH: number;
  kerf: number;
  allowRotation?: boolean;
}

export interface SplitTramoInfo {
  /** 1-based index of this tramo within the original oversized piece. */
  tramo: number;
  /** Total number of tramos the original piece was split into. */
  total: number;
}

export interface PlacedPiece {
  pieceId: number;
  pieceIndex: number; // which copy (0..cantidad-1) of this piece
  origen?: number; // 1-based index of the original input piece (matches the "#" column)
  nombre?: string;
  x: number;
  y: number;
  w: number; // footprint width  (largo + kerf*2 when not rotated, etc.)
  h: number; // footprint height
  largo: number; // nominal largo
  ancho: number; // nominal ancho
  rotated: boolean;
  m2: number; // nominal area of the piece
  split?: SplitTramoInfo; // present when the piece was auto-split (oversized length)
}

export interface PlateLayout {
  index: number; // 0-based
  plateM2: number;
  usedM2: number; // sum of nominal piece m2 placed on this plate
  pieces: PlacedPiece[];
}

export interface PackAction {
  action: 'placed' | 'unplaced';
  pieceId: number;
  pieceIndex: number;
  origen?: number; // 1-based index of the original input piece
  nombre?: string;
  largo: number;
  ancho: number;
  split?: SplitTramoInfo; // present when this is a tramo of an auto-split piece
}

export interface GuillotineResult {
  plates: PlateLayout[];
  platesNeeded: number;
  piecesM2: number; // nominal m2 of all pieces (placed + unplaced)
  placedM2: number; // nominal m2 of placed pieces
  platesM2Bought: number; // platesNeeded * plateW * plateH
  utilizationPct: number; // placedM2 / platesM2Bought * 100
  wastePct: number; // 100 - utilizationPct
  unplaced: PackAction[];
  plateW: number;
  plateH: number;
  kerf: number;
  usedM2: number; // alias of placedM2 for convenience
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Item {
  pieceId: number;
  pieceIndex: number;
  origen: number; // 1-based index of the original input piece
  nombre?: string;
  largo: number;
  ancho: number;
  fw: number; // footprint width
  fh: number; // footprint height
  area: number; // nominal area
  split?: SplitTramoInfo;
}

interface Fit {
  plateIndex: number;
  rectIndex: number;
  w: number;
  h: number;
  rotated: boolean;
}

interface PlateBuild {
  pieces: PlacedPiece[];
  freeRects: FreeRect[];
}

/**
 * Ordering strategies tried by the multi-pass packer. Each sorts the SAME item
 * list and runs a full sequence; ties between layouts are broken by the order
 * of this array (a heuristic that appears earlier wins).
 */
export type PackHeuristic =
  | 'area' // footprint area desc
  | 'longerSide' // longest side of the footprint desc
  | 'perimeter' // footprint perimeter desc
  | 'width' // footprint width desc
  | 'height' // footprint height desc
  | 'shortSide'; // shortest side of the footprint desc

/** Deterministic heuristic order: "area" is the tie-breaker default. */
export const HEURISTIC_ORDER: PackHeuristic[] = [
  'area',
  'longerSide',
  'perimeter',
  'width',
  'height',
  'shortSide',
];

/** Float tolerance for adjacency/merge checks (well below the 1e-6 guard). */
const EPS = 1e-6;

/**
 * Finds the best free rectangle + orientation for a footprint.
 * Best = smallest wasted area inside the chosen free rect; ties broken by
 * preferring the footprint that leaves the larger single leftover band
 * (fewer slivers → better downstream fits).
 */
function bestFit(
  fw: number,
  fh: number,
  allowRotation: boolean,
  plates: PlateBuild[],
): Fit | null {
  let best: Fit | null = null;
  let bestScore = Infinity;

  for (let pi = 0; pi < plates.length; pi++) {
    const plate = plates[pi];
    for (let ri = 0; ri < plate.freeRects.length; ri++) {
      const r = plate.freeRects[ri];
      const orientations = [
        { w: fw, h: fh, rotated: false },
        ...(allowRotation ? [{ w: fh, h: fw, rotated: true }] : []),
      ];

      for (const o of orientations) {
        if (o.w <= r.w && o.h <= r.h) {
          const leftoverSide = Math.min(r.w - o.w, r.h - o.h);
          const waste = r.w * r.h - o.w * o.h;
          // Tiny per-plate tie-break: on EXACT score ties prefer earlier
          // plates, so small pieces fill previous plates before a new one
          // (worth nearly one plate) is opened.
          const score = leftoverSide * 1000 + waste + pi * 1e-6;
          if (score < bestScore) {
            bestScore = score;
            best = {
              plateIndex: pi,
              rectIndex: ri,
              w: o.w,
              h: o.h,
              rotated: o.rotated,
            };
          }
        }
      }
    }
  }

  return best;
}

/**
 * Whether the ROTATED orientation wastes less space on a FRESH plate. Both
 * orientations fit (caller guarantees it). Compares the larger of the two
 * leftover bands in each orientation: rotation is preferred only when it
 * leaves a strictly larger minimal leftover band (fewer slivers → better
 * downstream fits). Non-rotated is kept for ties, preserving the semantic
 * "a piece small enough to fit normally is NOT flipped" of the old packer.
 */
function betterNewPlateOrientation(
  fw: number,
  fh: number,
  plateW: number,
  plateH: number,
): boolean {
  const normalMin = Math.min(plateW - fw, plateH - fh);
  const rotatedMin = Math.min(plateW - fh, plateH - fw);
  return rotatedMin > normalMin;
}

/**
 * Stable sort of a COPY of the items under one heuristic. Rank keys only; the
 * original relative order (notably the tramo order of an auto-split piece) is
 * preserved among items with equal keys because `Array.prototype.sort` is
 * stable (ES2019+).
 */
function sortItems(items: Item[], heuristic: PackHeuristic): Item[] {
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
 * Merges horizontally/vertically adjacent free rectangles with the same other
 * dimension into one bigger free rect. Runs until a fixpoint because a merge
 * can enable another merge (e.g. two horizontal bands followed by a vertical
 * merge). Only merges rects that touch edge-to-edge within EPS and align
 * exactly on the shared side — the union is guaranteed free (both source rects
 * are free and disjoint from every placed piece).
 */
function mergeFreeRects(rects: FreeRect[]): FreeRect[] {
  const out: FreeRect[] = [...rects];
  let merged = true;

  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        const sameRow = Math.abs(a.y - b.y) < EPS && Math.abs(a.h - b.h) < EPS;
        const sameCol = Math.abs(a.x - b.x) < EPS && Math.abs(a.w - b.w) < EPS;
        if (sameRow && Math.abs(a.x + a.w - b.x) < EPS) {
          out[i] = { x: a.x, y: a.y, w: a.w + b.w, h: a.h };
          out.splice(j, 1); // j > i: removing the higher index is safe.
          merged = true;
          break outer;
        }
        if (sameRow && Math.abs(b.x + b.w - a.x) < EPS) {
          out[i] = { x: b.x, y: b.y, w: a.w + b.w, h: a.h };
          out.splice(j, 1);
          merged = true;
          break outer;
        }
        if (sameCol && Math.abs(a.y + a.h - b.y) < EPS) {
          out[i] = { x: a.x, y: a.y, w: a.w, h: a.h + b.h };
          out.splice(j, 1);
          merged = true;
          break outer;
        }
        if (sameCol && Math.abs(b.y + b.h - a.y) < EPS) {
          out[i] = { x: a.x, y: b.y, w: a.w, h: a.h + b.h };
          out.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  return out;
}

/**
 * Nominal area left unplaced (square meters). Primary quality metric of a
 * layout: the winning layout unplaces the least area possible.
 */
function unplacedArea(unplaced: PackAction[]): number {
  return unplaced.reduce((s, u) => s + u.largo * u.ancho, 0);
}

/**
 * Chooses the better of two candidate layouts: fewer unplaced area first,
 * then fewer plates, then higher utilization. Exact ties keep the previous
 * one, so the earlier heuristic in HEURISTIC_ORDER wins deterministically.
 */
function better(
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

/**
 * Splits a free rectangle around a placed footprint (occupying the top-left
 * corner) with exactly ONE guillotine cut — a single straight blade path from
 * one edge of the free rect to the other.
 *
 * The cut is drawn along the piece's opposite edge, "closing" the freed band:
 *   - if the remaining width is the smaller leftover, cut vertically flush with
 *     the piece's right edge → a full-height strip on the right and the space
 *     below the piece;
 *   - otherwise cut horizontally flush with the piece's bottom edge → a
 *     full-width strip below and the space to the piece's right.
 *
 * The two resulting free rects are mutually disjoint and together tile the
 * original free rect minus the footprint, so no piece can ever be packed into
 * a region that overlaps an existing piece.
 */
function splitFreeRect(
  rect: FreeRect,
  fw: number,
  fh: number,
): FreeRect[] {
  const restW = rect.w - fw;
  const restH = rect.h - fh;
  const out: FreeRect[] = [];

  if (restW <= restH) {
    // Vertical cut: right strip keeps the full height.
    if (restW > 0) out.push({ x: rect.x + fw, y: rect.y, w: restW, h: rect.h });
    // Bottom region keeps the footprint width but loses the footprint height.
    if (restH > 0) out.push({ x: rect.x, y: rect.y + fh, w: fw, h: restH });
  } else {
    // Horizontal cut: bottom strip keeps the full width.
    if (restH > 0) out.push({ x: rect.x, y: rect.y + fh, w: rect.w, h: restH });
    // Right region keeps the footprint height but loses the footprint width.
    if (restW > 0) out.push({ x: rect.x + fw, y: rect.y, w: restW, h: fh });
  }

  return out;
}

/**
 * Rounds to mm precision (3 decimals) — enough for the split arithmetic to
 * avoid float residue (e.g. 4.1 - 3.0 = 1.0999999999999996 → 1.1).
 */
function roundM(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Footprint of a piece along ONE axis given its nominal dimension and the full
 * plate dimension on that axis. When the measured dimension equals the plate's
 * (within EPS, i.e. the piece runs edge-to-edge using the factory edges),
 * NO kerf is added on that axis: the factory edge needs no cut, so a 3.00m
 * piece in a 3.00m plate fits flush. Otherwise the blade margin applies on
 * both sides as usual (dim + kerf*2).
 */
function factoryFootprint(dim: number, plateDim: number, kerf: number): number {
  return Math.abs(dim - plateDim) < EPS ? dim : dim + kerf * 2;
}

/**
 * Splits a length along the largo axis into tramos of at most `max` meters.
 * The first tramos are `max` (the full plate length) and the leftover goes
 * last (e.g. 4.1 in a 3.0 plate → [3.0, 1.1]). Trailing float residue smaller
 * than 1e-6 is ignored (it rounded to a zero-length tramo).
 */
function splitAlongLength(total: number, max: number): number[] {
  const out: number[] = [];
  let remaining = total;
  while (remaining > 1e-6) {
    const t = Math.min(max, remaining);
    out.push(roundM(t));
    remaining -= t;
  }
  return out;
}

/**
 * Expands the input pieces into individual items (one per copy × per auto-split
 * tramo), computing the footprint, fits and the split metadata per item. Items
 * whose footprint cannot fit the plate in either orientation (too wide, without
 * an oversized length to split) are still added so the sequence reports them as
 * `unplaced`.
 */
function buildItems(pieces: PackPieceInput[], options: PackOptions): Item[] {
  const { plateW, plateH, kerf } = options;
  const allowRotation = options.allowRotation ?? true;

  const items: Item[] = [];
  for (let oi = 0; oi < pieces.length; oi++) {
    const p = pieces[oi];
    const cantidad = Math.max(1, Math.floor(p.cantidad) || 1);
    // Factory-edge rule: a dimension equal to the full plate axis spans the
    // factory edges → no kerf on that axis (e.g. 3.00m in a 3.00m plate fits
    // flush instead of needing 3.005m).
    const fw = factoryFootprint(p.largo, plateW, kerf);
    const fh = factoryFootprint(p.ancho, plateH, kerf);
    const fitsNormal = fw <= plateW && fh <= plateH;
    const fitsRotated = allowRotation && fh <= plateW && fw <= plateH;
    // Auto-split: a piece neither fits normally nor rotated AND its nominal
    // largo exceeds the plate length → break it along the largo into tramos
    // ([plateW, plateW, ..., leftover]), each packed independently. Too-wide
    // pieces (ancho overflow, no largo overflow) keep the "unplaced" meaning.
    const tramos =
      !fitsNormal && !fitsRotated && p.largo > plateW
        ? splitAlongLength(p.largo, plateW)
        : null;
    for (let i = 0; i < cantidad; i++) {
      if (tramos) {
        const total = tramos.length;
        for (let t = 0; t < total; t++) {
          const tramoLargo = tramos[t];
          items.push({
            pieceId: p.id,
            pieceIndex: i,
            origen: oi + 1,
            nombre: p.nombre,
            largo: tramoLargo,
            ancho: p.ancho,
            // A tramo flush with the full plate length uses the factory edge
            // (no kerf consumed along that side), so it fits exactly `plateW`.
            fw: Math.min(tramoLargo + kerf * 2, plateW),
            fh,
            area: tramoLargo * p.ancho,
            split: { tramo: t + 1, total },
          });
        }
      } else {
        items.push({
          pieceId: p.id,
          pieceIndex: i,
          origen: oi + 1,
          nombre: p.nombre,
          largo: p.largo,
          ancho: p.ancho,
          fw,
          fh,
          area: p.largo * p.ancho,
        });
      }
    }
  }
  return items;
}

/**
 * Runs ONE full guillotine sequence over a pre-sorted item list: fits each
 * item into the best existing free rectangle (both orientations, any plate),
 * merging the plate's free rectangles after every placement; opens a new plate
 * only when NOTHING fits in the existing ones.
 */
function packSequence(
  sorted: Item[],
  options: PackOptions,
  plateM2: number,
): GuillotineResult {
  const { plateW, plateH, kerf, allowRotation = true } = options;
  const platesBuild: PlateBuild[] = [];
  const placed: PlacedPiece[] = [];
  const unplaced: PackAction[] = [];

  for (const item of sorted) {
    // Does the footprint fit inside the plate in either orientation?
    const fitsNormal = item.fw <= plateW && item.fh <= plateH;
    const fitsRotated = allowRotation && item.fh <= plateW && item.fw <= plateH;

    if (!fitsNormal && !fitsRotated) {
      unplaced.push({
        action: 'unplaced',
        pieceId: item.pieceId,
        pieceIndex: item.pieceIndex,
        origen: item.origen,
        nombre: item.nombre,
        largo: item.largo,
        ancho: item.ancho,
        split: item.split,
      });
      continue;
    }

    // bestFit already tries every free rect of every EXISTING plate in both
    // orientations — a small piece rotated into a previous plate's leftover is
    // the natural outcome before any new plate is considered.
    let fit = bestFit(item.fw, item.fh, allowRotation, platesBuild);

    if (!fit) {
      // Open a new plate and place into its single (full) free rect, picking
      // the orientation that fits best on a fresh plate: the forced one when
      // only one orientation fits, otherwise whichever leaves the larger
      // minimal leftover band (betterNewPlateOrientation).
      const plate: PlateBuild = {
        pieces: [],
        freeRects: [{ x: 0, y: 0, w: plateW, h: plateH }],
      };
      platesBuild.push(plate);
      const useRotated =
        !fitsNormal ||
        (fitsRotated && betterNewPlateOrientation(item.fw, item.fh, plateW, plateH));
      fit = {
        plateIndex: platesBuild.length - 1,
        rectIndex: 0,
        w: useRotated ? item.fh : item.fw,
        h: useRotated ? item.fw : item.fh,
        rotated: useRotated,
      };
    }

    const plate = platesBuild[fit.plateIndex];
    const rect = plate.freeRects[fit.rectIndex];
    plate.freeRects.splice(fit.rectIndex, 1);
    plate.freeRects.push(...splitFreeRect(rect, fit.w, fit.h));
    // Consolidate adjacent free bands AFTER every placement so a small piece
    // may use the merged region instead of forcing a new (nearly empty) plate.
    plate.freeRects = mergeFreeRects(plate.freeRects);

    const piece: PlacedPiece = {
      pieceId: item.pieceId,
      pieceIndex: item.pieceIndex,
      origen: item.origen,
      nombre: item.nombre,
      x: rect.x,
      y: rect.y,
      w: fit.w,
      h: fit.h,
      largo: item.largo,
      ancho: item.ancho,
      rotated: fit.rotated,
      m2: item.area,
      split: item.split,
    };
    plate.pieces.push(piece);
    placed.push(piece);
  }

  const plates: PlateLayout[] = platesBuild.map((pb, i) => ({
    index: i,
    plateM2,
    usedM2: pb.pieces.reduce((sum, p) => sum + p.m2, 0),
    pieces: pb.pieces,
  }));

  const piecesM2 = sorted.reduce((s, i) => s + i.area, 0);
  const placedM2 = placed.reduce((s, p) => s + p.m2, 0);
  const platesNeeded = plates.length;
  const platesM2Bought = platesNeeded * plateM2;
  const utilizationPct =
    platesM2Bought > 0 ? (placedM2 / platesM2Bought) * 100 : 0;

  return {
    plates,
    platesNeeded,
    piecesM2,
    placedM2,
    platesM2Bought,
    utilizationPct,
    wastePct: Math.max(0, 100 - utilizationPct),
    unplaced,
    plateW,
    plateH,
    kerf,
    usedM2: placedM2,
  };
}

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