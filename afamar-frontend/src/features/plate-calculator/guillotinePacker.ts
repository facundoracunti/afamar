/**
 * Guillotine bin-packing (2D) for stone/quartz plates.
 *
 * All positions are in meters (plate is plateW × plateH). The kerf (blade
 * width, in meters) is added to BOTH sides of every piece, so a piece of
 * nominal size (largo × ancho) occupies a footprint of
 * (largo + kerf*2) × (ancho + kerf*2) inside the plate. Pieces may be
 * rotated 90° when `allowRotation` is true (default).
 *
 * The algorithm uses a classic "free rectangles" guillotine split: each free
 * rectangle is split along its shorter remaining side so every cut spans the
 * full current free rect (edge-to-edge, horizontal or vertical — a real
 * guillotine cut). This guarantees:
 *   - every placed piece fits fully inside its plate (no overflow)
 *   - no two pieces overlap each other inside a plate
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

export interface PlacedPiece {
  pieceId: number;
  pieceIndex: number; // which copy (0..cantidad-1) of this piece
  nombre?: string;
  x: number;
  y: number;
  w: number; // footprint width  (largo + kerf*2 when not rotated, etc.)
  h: number; // footprint height
  largo: number; // nominal largo
  ancho: number; // nominal ancho
  rotated: boolean;
  m2: number; // nominal area of the piece
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
  nombre?: string;
  largo: number;
  ancho: number;
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
  nombre?: string;
  largo: number;
  ancho: number;
  fw: number; // footprint width
  fh: number; // footprint height
  area: number; // nominal area
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
          const score = leftoverSide * 1000 + waste;
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
 * Guillotine pack: sorts items by footprint area desc, first-fit into the
 * existing plates when a spot fits, opening a new plate otherwise.
 */
export function packGuillotine(
  pieces: PackPieceInput[],
  options: PackOptions,
): GuillotineResult {
  const { plateW, plateH, kerf } = options;
  const allowRotation = options.allowRotation ?? true;
  const plateM2 = plateW * plateH;

  const items: Item[] = [];
  for (const p of pieces) {
    const cantidad = Math.max(1, Math.floor(p.cantidad) || 1);
    for (let i = 0; i < cantidad; i++) {
      items.push({
        pieceId: p.id,
        pieceIndex: i,
        nombre: p.nombre,
        largo: p.largo,
        ancho: p.ancho,
        fw: p.largo + kerf * 2,
        fh: p.ancho + kerf * 2,
        area: p.largo * p.ancho,
      });
    }
  }

  items.sort((a, b) => b.fw * b.fh - a.fw * a.fh);

  const platesBuild: PlateBuild[] = [];
  const placed: PlacedPiece[] = [];
  const unplaced: PackAction[] = [];

  for (const item of items) {
    // Does the footprint fit inside the plate in either orientation?
    const fitsNormal = item.fw <= plateW && item.fh <= plateH;
    const fitsRotated = allowRotation && item.fh <= plateW && item.fw <= plateH;

    if (!fitsNormal && !fitsRotated) {
      unplaced.push({
        action: 'unplaced',
        pieceId: item.pieceId,
        pieceIndex: item.pieceIndex,
        nombre: item.nombre,
        largo: item.largo,
        ancho: item.ancho,
      });
      continue;
    }

    let fit = bestFit(item.fw, item.fh, allowRotation, platesBuild);

    if (!fit) {
      // Open a new plate and place into its single (full) free rect, picking
      // the orientation that actually fits.
      const plate: PlateBuild = {
        pieces: [],
        freeRects: [{ x: 0, y: 0, w: plateW, h: plateH }],
      };
      platesBuild.push(plate);
      const useRotated = !fitsNormal && fitsRotated;
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

    const piece: PlacedPiece = {
      pieceId: item.pieceId,
      pieceIndex: item.pieceIndex,
      nombre: item.nombre,
      x: rect.x,
      y: rect.y,
      w: fit.w,
      h: fit.h,
      largo: item.largo,
      ancho: item.ancho,
      rotated: fit.rotated,
      m2: item.area,
    };
    plate.pieces.push(piece);
    placed.push(piece);
  }

  const plates: PlateLayout[] = platesBuild.map((pb, i) => {
    const usedM2 = pb.pieces.reduce((sum, p) => sum + p.m2, 0);
    return {
      index: i,
      plateM2,
      usedM2,
      pieces: pb.pieces,
    };
  });

  const piecesM2 = items.reduce((s, i) => s + i.area, 0);
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