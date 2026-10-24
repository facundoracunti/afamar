/**
 * `useSketchState` — grid snapping (geometry).
 *
 * The editor snaps coordinates to a 20px grid. Two flavours:
 *  - `snapCoord` — hard snap (always lands on the grid).
 *  - `snapNear`   — soft snap (only snaps when the pointer is within
 *    `SNAP_RANGE` px of a grid line).
 *
 * Both are pure and take the "snap enabled" flag explicitly so the hook can
 * expose them already bound to the current toggle.
 */

/** Grid pitch in px. */
export const GRID = 20;

/** Max distance (px) from a grid line for `snapNear` to pull the value. */
export const SNAP_RANGE = 5;

/** Hard snap: always rounds the value to the nearest grid multiple. */
export function snapCoord(v: number, on: boolean): number {
  return on ? Math.round(v / GRID) * GRID : v;
}

/** Soft snap: rounds to the nearest grid multiple only when close enough. */
export function snapNear(v: number, on: boolean): number {
  if (!on) return v;
  const r = Math.round(v / GRID) * GRID;
  return Math.abs(v - r) <= SNAP_RANGE ? r : v;
}
