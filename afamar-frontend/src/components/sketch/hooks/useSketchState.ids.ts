/**
 * `useSketchState` — id generators.
 *
 * The editor needs two independent id spaces:
 *  - element ids (`e<base36 time>_<counter>`) for shapes,
 *  - page ids (a simple increasing integer) for croquis pages.
 *
 * The counters live at MODULE level on purpose: they must be shared by
 * every caller of this module (the normalizer mints ids for elements that
 * arrive without one), exactly as before the split.
 */

let _cid = 0;

/** Mints a unique element id (`e<base36 time>_<counter>`). */
export const uid = (): string => `e${Date.now().toString(36)}_${++_cid}`;

let _pid = 100;

/** Mints a unique page id (increasing integer). */
export const pid = (): number => ++_pid;
