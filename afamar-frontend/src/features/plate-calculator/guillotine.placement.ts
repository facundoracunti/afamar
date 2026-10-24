import type { Fit, FreeRect, PlateBuild } from './guillotine.types';

/**
 * Finds the best free rectangle + orientation for a footprint.
 * Best = smallest wasted area inside the chosen free rect; ties broken by
 * preferring the footprint that leaves the larger single leftover band
 * (fewer slivers → better downstream fits).
 */
export function bestFit(
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
export function betterNewPlateOrientation(
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
export function splitFreeRect(
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
