/**
 * `CanvasArea` — stage geometry constants and helpers.
 *
 * The Konva stage lives in a FIXED logical coordinate space
 * (`SKETCH_STAGE_WIDTH` × `SKETCH_STAGE_HEIGHT`); it is scaled down to fit
 * the container, never up. Every coordinate the editor produces is clamped
 * to that space so nothing can be dragged off-canvas.
 */
import { SKETCH_STAGE_WIDTH, SKETCH_STAGE_HEIGHT } from '../../../constants';

/** Grid pitch in px. */
export const GRID = 20;

/** Logical stage width (px). */
export const STAGE_W = SKETCH_STAGE_WIDTH;

/** Logical stage height (px). */
export const STAGE_H = SKETCH_STAGE_HEIGHT;

/** Minimum drag distance (px) for a shape to be created. */
export const MIN_DIST = 4;

/** Clamps a coordinate to `[0.5, max - 0.5]`. */
export function clampCoord(v: number, max: number): number {
  return Math.max(0.5, Math.min(max - 0.5, v));
}

let _tid = 0;

/** Mints a unique element id for a shape drawn on the canvas. */
export function genId(): string {
  return `e${Date.now().toString(36)}_${++_tid}`;
}
