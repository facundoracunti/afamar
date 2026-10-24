/**
 * `useSketchState` — element (shape) mutators.
 *
 * Every mutation targets the ACTIVE page (`pageIdx`) and goes through
 * `persist`, which pushes an undo snapshot and notifies the parent form.
 * Selection (`sid`) is cleared when a shape is removed.
 */
import { useCallback } from 'react';
import type { SketchElement, SketchPage } from '../../../types/sketch';

export interface SketchElementActions {
  addShape: (shape: SketchElement) => void;
  deleteShape: (id: string) => void;
  deleteLast: () => void;
  clearAll: () => void;
  updateElementPosition: (id: string, absX: number, absY: number) => void;
  updateElementTransform: (id: string, next: SketchElement) => void;
}

export function useSketchElementActions(params: {
  pages: SketchPage[];
  pageIdx: number;
  persist: (updatedPages: SketchPage[]) => void;
  setSid: (s: string | null) => void;
}): SketchElementActions {
  const { pages, pageIdx, persist, setSid } = params;

  const addShape = useCallback((shape: SketchElement) => {
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: [...p.elements, shape] } : p,
    );
    persist(next);
  }, [pages, pageIdx, persist]);

  const deleteShape = useCallback((id: string) => {
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: p.elements.filter((el) => el.id !== id) } : p,
    );
    setSid(null);
    persist(next);
  }, [pages, pageIdx, persist, setSid]);

  const deleteLast = useCallback(() => {
    const current = pages[pageIdx]?.elements || [];
    if (current.length === 0) return;
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: p.elements.slice(0, -1) } : p,
    );
    setSid(null);
    persist(next);
  }, [pages, pageIdx, persist, setSid]);

  const clearAll = useCallback(() => {
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: [] } : p,
    );
    setSid(null);
    persist(next);
  }, [pages, pageIdx, persist, setSid]);

  const updateElementPosition = useCallback((id: string, absX: number, absY: number) => {
    const updatedShapes = pages[pageIdx].elements.map((shape) => {
      if (shape.id !== id) return shape;
      if (shape.type === 'line') {
        const dx = absX - (shape.x || 0);
        const dy = absY - (shape.y || 0);
        const newPoints: number[] = shape.points.map((p, idx) =>
          idx % 2 === 0 ? p + dx : p + dy,
        );
        return { ...shape, points: newPoints, x: 0, y: 0 };
      }
      if (shape.type === 'circle') {
        return { ...shape, cx: absX, cy: absY };
      }
      return { ...shape, x: absX, y: absY };
    });
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: updatedShapes } : p,
    );
    persist(next);
  }, [pages, pageIdx, persist]);

  const updateElementTransform = useCallback((id: string, next: SketchElement) => {
    const updatedShapes = pages[pageIdx].elements.map((el) =>
      el.id === id ? next : el,
    );
    const updatedPages = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: updatedShapes } : p,
    );
    persist(updatedPages);
  }, [pages, pageIdx, persist]);

  return {
    addShape,
    deleteShape,
    deleteLast,
    clearAll,
    updateElementPosition,
    updateElementTransform,
  };
}
