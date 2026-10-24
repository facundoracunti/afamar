import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  SketchToolType,
  SketchPage,
  Point,
} from '../../../types/sketch';
import { snapCoord as snapCoordValue, snapNear as snapNearValue } from './useSketchState.geometry';
import { normPages } from './useSketchState.normalization';
import { canonicalJSON, clonePages, savePayload } from './useSketchState.persistence';
import { useSketchElementActions } from './useSketchState.elements';
import { useSketchHistoryActions } from './useSketchState.history';
import { useSketchPageActions } from './useSketchState.pages';
import type { UseSketchStateReturn } from './useSketchState.types';

export type { UseSketchStateReturn } from './useSketchState.types';

/** Editor state of the croquis: pages, selection, drawing flags, history.
 *
 *  This file is the ORCHESTRATOR (see ADR 0009): the state lives here while
 *  each concern is delegated to a focused sub-module:
 *
 *   - `useSketchState.geometry.ts`     — grid snapping.
 *   - `useSketchState.normalization.ts` — wire → editor normalization.
 *   - `useSketchState.persistence.ts`  — wire payload + history snapshots.
 *   - `useSketchState.elements.ts`     — shape mutators.
 *   - `useSketchState.history.ts`      — undo / redo.
 *   - `useSketchState.pages.ts`        — page mutators.
 */
export function useSketchState(
  sketch: unknown,
  onChange: (v: unknown) => void,
  _readOnly: boolean,
): UseSketchStateReturn {
  const [pages, setPages] = useState<SketchPage[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<SketchToolType>('select');
  const [snap, setSnap] = useState(true);
  const [sid, setSid] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawEnd, setDrawEnd] = useState<Point | null>(null);
  const [history, setHistory] = useState<SketchPage[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const shiftRef = useRef(false);

  const currentShapes = pages[pageIdx]?.elements || [];

  const persist = useCallback((updatedPages: SketchPage[]) => {
    setPages(updatedPages);
    onChange(savePayload(updatedPages));
    setHistory((prev) => {
      const cut = prev.slice(0, historyIndex + 1);
      const cloned = clonePages(updatedPages);
      const next = [...cut, cloned];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex, onChange]);

  useEffect(() => {
    const pp = normPages(sketch);
    setPages((prev) => {
      // If the incoming `sketch` is structurally identical to the current
      // `pages` state, skip the re-init entirely. This is the common case
      // during a session: every shape add/remove/move calls `persist()`,
      // which calls `onChange(savePayload(updatedPages))` and triggers a new
      // `sketch` prop reference. Without this guard, `pageIdx` and
      // `history` would be wiped on every single click — the user couldn't
      // even move between pages without losing their selection state.
      //
      // IMPORTANT: both sides must go through the SAME normalisation
      // pipeline (`normPages(savePayload(...))`). The raw `prev` state is
      // NOT byte-identical to `pp` even for a faithful round-trip: drawn
      // elements are stored without their defaults (a line has no `x`/`y`,
      // a rect has no `rotation`) while `normEls` fills those in. A naive
      // `JSON.stringify` / key-sorted comparison would therefore ALWAYS
      // mismatch and re-init — resetting `pageIdx` to 0 and wiping undo on
      // every single select. This is what made the per-page material pick
      // in the toolbar appear to "not save" (it jumped back to page 1).
      if (canonicalJSON(normPages(savePayload(prev))) === canonicalJSON(pp)) return prev;
      // Otherwise (initial load or external replacement), re-init everything.
      setPageIdx(0);
      setSid(null);
      setReady(true);
      setHistory([clonePages(pp)]);
      setHistoryIndex(0);
      return pp;
    });
  }, [sketch]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const buildPayload = useCallback((): unknown => savePayload(pages), [pages]);

  const {
    addShape,
    deleteShape,
    deleteLast,
    clearAll,
    updateElementPosition,
    updateElementTransform,
  } = useSketchElementActions({ pages, pageIdx, persist, setSid });

  const { canUndo, canRedo, undo, redo } = useSketchHistoryActions({
    history,
    historyIndex,
    setHistoryIndex,
    setPages,
    setSid,
    onChange,
  });

  const { addPage, removePage, renamePage, setPageMaterial } = useSketchPageActions({
    pages,
    pageIdx,
    onChange,
    setPages,
    setPageIdx,
    setSid,
  });

  const handleSetTool = useCallback((t: SketchToolType) => {
    setTool(t);
    setIsDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
    setSid(null);
  }, []);

  return {
    pages,
    pageIdx,
    tool,
    snap,
    sid,
    isDrawing,
    drawStart,
    drawEnd,
    ready,
    canUndo,
    canRedo,
    currentShapes,
    shiftRef,

    setTool: handleSetTool,
    setSnap,
    setSid,
    setPageIdx,
    setIsDrawing,
    setDrawStart,
    setDrawEnd,
    setPages,

    addShape,
    deleteShape,
    deleteLast,
    clearAll,
    updateElementPosition,
    updateElementTransform,

    undo,
    redo,

    addPage,
    removePage,
    renamePage,
    setPageMaterial,

    buildPayload,

    snapCoord: (v: number) => snapCoordValue(v, snap),
    snapNear: (v: number) => snapNearValue(v, snap),
  };
}
