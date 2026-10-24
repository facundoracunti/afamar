/**
 * `useSketchState` — undo / redo history.
 *
 * The history is a list of page snapshots; `historyIndex` points at the
 * CURRENT one. `undo`/`redo` restore a snapshot WITHOUT pushing a new one
 * (that would grow the history on every undo).
 */
import { useCallback } from 'react';
import type { SketchPage } from '../../../types/sketch';
import { clonePages, savePayload } from './useSketchState.persistence';

export interface SketchHistoryActions {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export function useSketchHistoryActions(params: {
  history: SketchPage[][];
  historyIndex: number;
  setHistoryIndex: (i: number) => void;
  setPages: (p: SketchPage[]) => void;
  setSid: (s: string | null) => void;
  onChange: (v: unknown) => void;
}): SketchHistoryActions {
  const {
    history,
    historyIndex,
    setHistoryIndex,
    setPages,
    setSid,
    onChange,
  } = params;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const ni = historyIndex - 1;
    const restored = history[ni];
    if (!restored) return;
    setHistoryIndex(ni);
    setSid(null);
    const next = clonePages(restored);
    setPages(next);
    onChange(savePayload(next));
  }, [historyIndex, history, onChange, setHistoryIndex, setPages, setSid]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const ni = historyIndex + 1;
    const restored = history[ni];
    if (!restored) return;
    setHistoryIndex(ni);
    setSid(null);
    const next = clonePages(restored);
    setPages(next);
    onChange(savePayload(next));
  }, [historyIndex, history, onChange, setHistoryIndex, setPages, setSid]);

  return { canUndo, canRedo, undo, redo };
}
