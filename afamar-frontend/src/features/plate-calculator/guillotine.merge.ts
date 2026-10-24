import { EPS } from './guillotine.constants';
import type { FreeRect } from './guillotine.types';

/**
 * Merges horizontally/vertically adjacent free rectangles with the same other
 * dimension into one bigger free rect. Runs until a fixpoint because a merge
 * can enable another merge (e.g. two horizontal bands followed by a vertical
 * merge). Only merges rects that touch edge-to-edge within EPS and align
 * exactly on the shared side — the union is guaranteed free (both source rects
 * are free and disjoint from every placed piece).
 */
export function mergeFreeRects(rects: FreeRect[]): FreeRect[] {
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
