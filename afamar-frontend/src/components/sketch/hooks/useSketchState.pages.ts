/**
 * `useSketchState` — page mutators (add / remove / rename / material).
 *
 * These mutators do NOT push an undo snapshot: they are structural changes
 * to the croquis pages (not to the drawing), so they only persist through
 * `onChange` and reset the selection.
 */
import { useCallback } from 'react';
import type { SketchPage } from '../../../types/sketch';
import { pid } from './useSketchState.ids';
import { savePayload } from './useSketchState.persistence';

export interface SketchPageActions {
  addPage: () => void;
  removePage: (pageId: number) => void;
  renamePage: (pageId: number, name: string) => void;
  setPageMaterial: (pageId: number, material: string) => void;
}

export function useSketchPageActions(params: {
  pages: SketchPage[];
  pageIdx: number;
  onChange: (v: unknown) => void;
  setPages: (p: SketchPage[]) => void;
  setPageIdx: (i: number) => void;
  setSid: (s: string | null) => void;
}): SketchPageActions {
  const { pages, pageIdx, onChange, setPages, setPageIdx, setSid } = params;

  const addPage = useCallback(() => {
    const name = prompt('Nombre de la p\u00e1gina:', `P\u00e1gina ${pages.length + 1}`);
    if (!name || !name.trim()) return;
    const newPage: SketchPage = { id: pid(), name: name.trim(), elements: [] };
    const next = [...pages, newPage];
    setPages(next);
    setPageIdx(next.length - 1);
    setSid(null);
    onChange(savePayload(next));
  }, [pages, onChange, setPageIdx, setPages, setSid]);

  const removePage = useCallback((pageId: number) => {
    if (pages.length <= 1) return;
    const next = pages.filter((p) => p.id !== pageId);
    const newIdx = Math.min(pageIdx, next.length - 1);
    setPages(next);
    setPageIdx(newIdx);
    setSid(null);
    onChange(savePayload(next));
  }, [pages, pageIdx, onChange, setPageIdx, setPages, setSid]);

  const renamePage = useCallback((pageId: number, name: string) => {
    if (!name.trim()) return;
    const next = pages.map((p) =>
      p.id === pageId ? { ...p, name: name.trim() } : p,
    );
    setPages(next);
    onChange(savePayload(next));
  }, [pages, onChange, setPages]);

  const setPageMaterial = useCallback((pageId: number, material: string) => {
    const next = pages.map((p) =>
      p.id === pageId ? { ...p, material: material.trim() || undefined } : p,
    );
    setPages(next);
    onChange(savePayload(next));
  }, [pages, onChange, setPages]);

  return { addPage, removePage, renamePage, setPageMaterial };
}
