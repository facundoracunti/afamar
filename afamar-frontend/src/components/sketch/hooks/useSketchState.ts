import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  SketchToolType,
  SketchElement,
  SketchLine,
  SketchRect,
  SketchCutout,
  SketchText,
  SketchPage,
  Point,
  RawElement,
} from '../../../types/sketch';

const GRID = 20;
const SNAP_RANGE = 5;
let _cid = 0;
const uid = (): string => `e${Date.now().toString(36)}_${++_cid}`;
let _pid = 100;
const pid = (): number => ++_pid;

function snapCoord(v: number, on: boolean): number {
  return on ? Math.round(v / GRID) * GRID : v;
}

function snapNear(v: number, on: boolean): number {
  if (!on) return v;
  const r = Math.round(v / GRID) * GRID;
  return Math.abs(v - r) <= SNAP_RANGE ? r : v;
}

function normEls(arr: RawElement[]): SketchElement[] {
  return arr.map((el): SketchElement => {
    const id = String(el.id ?? uid());
    const t = el.type as string;

    if (t === 'line' && Array.isArray(el.points)) {
      return {
        id,
        type: 'line',
        points: el.points as number[],
        x: (el.x as number) ?? 0,
        y: (el.y as number) ?? 0,
        stroke: (el.stroke as string) || '#000',
        strokeWidth: (el.strokeWidth as number) ?? 2,
      } as SketchLine;
    }

    if (t === 'rect' && typeof el.x === 'number') {
      return {
        id,
        type: 'rect',
        x: el.x as number,
        y: el.y as number,
        width: (el.width as number) ?? (el.w as number) ?? 80,
        height: (el.height as number) ?? (el.h as number) ?? 50,
        fill: (el.fill as string) || 'transparent',
        stroke: (el.stroke as string) || '#000',
        strokeWidth: (el.strokeWidth as number) ?? 2,
        rotation: (el.rotation as number) ?? 0,
      } as SketchRect;
    }

    if ((t === 'cutout' || t === 'bacha' || t === 'anafe') && typeof el.x === 'number') {
      return {
        id,
        type: 'cutout',
        x: el.x as number,
        y: el.y as number,
        width: (el.width as number) ?? (el.ancho as number) ?? 80,
        height: (el.height as number) ?? (el.alto as number) ?? 50,
        fill: 'transparent',
        stroke: '#dc2626',
        strokeWidth: 2,
        dash: [4, 4],
        rotation: (el.rotation as number) ?? (el.rotacion as number) ?? 0,
      } as SketchCutout;
    }

    if (t === 'text' && typeof el.x === 'number') {
      return {
        id,
        type: 'text',
        x: el.x as number,
        y: el.y as number,
        text: (el.text as string) || '',
        fontSize: (el.fontSize as number) ?? 16,
        fill: (el.fill as string) || '#000',
        rotation: (el.rotation as number) ?? 0,
      } as SketchText;
    }

    if (t === 'line' && typeof el.x1 === 'number') {
      return {
        id,
        type: 'line',
        points: [el.x1 as number, el.y1 as number, el.x2 as number, el.y2 as number],
        stroke: (el.color as string) || '#000',
        strokeWidth: 2,
      } as SketchLine;
    }

    if (t === 'path') {
      const pts = (el.points as Array<Record<string, number>>) || [];
      const flat: number[] = [];
      pts.forEach((p) => { flat.push(p.x, p.y); });
      return {
        id,
        type: 'line',
        points: flat,
        stroke: (el.color as string) || '#000',
        strokeWidth: 2,
      } as SketchLine;
    }

    if (t === 'measure') {
      return {
        id,
        type: 'line',
        points: [el.x1 as number, el.y1 as number, el.x2 as number, el.y2 as number],
        stroke: '#000',
        strokeWidth: 1.5,
      } as SketchLine;
    }

    if (t === 'circle' || t === 'hole') {
      const r = (el.r as number) || 12;
      return {
        id,
        type: 'cutout',
        x: (el.x as number) - r,
        y: (el.y as number) - r,
        width: r * 2,
        height: r * 2,
        fill: 'transparent',
        stroke: '#dc2626',
        strokeWidth: 2,
        dash: [4, 4],
      } as SketchCutout;
    }

    return { id, type: (t || 'rect') as SketchElement['type'], x: 0, y: 0, width: 80, height: 50, fill: 'transparent', stroke: '#000', strokeWidth: 2 } as SketchElement;
  });
}

function normPages(sketch: unknown): SketchPage[] {
  if (!Array.isArray(sketch) || !sketch.length) {
    return [{ id: pid(), name: 'P�gina 1', elements: [] }];
  }
  if (!sketch[0]?.pagina_id) {
    return [{ id: pid(), name: 'P�gina 1', elements: normEls(sketch as RawElement[]) }];
  }
  return sketch.map((p: Record<string, unknown>, i: number): SketchPage => ({
    id: (p.pagina_id as number) || pid(),
    name: (p.nombre as string) || (p.name as string) || `P�gina ${i + 1}`,
    elements: normEls((p.dibujo || p.elements || []) as RawElement[]),
  }));
}

function savePayload(pages: SketchPage[]): unknown {
  return pages.map((p) => ({
    pagina_id: p.id,
    name: p.name,
    dibujo: p.elements.map(({ id, ...rest }) => ({ ...rest, id })),
  }));
}

function clonePages(pages: SketchPage[]): SketchPage[] {
  return pages.map((p) => ({ ...p, elements: p.elements.map((el) => ({ ...el })) }));
}

export interface UseSketchStateReturn {
  pages: SketchPage[];
  pageIdx: number;
  tool: SketchToolType;
  snap: boolean;
  sid: string | null;
  isDrawing: boolean;
  drawStart: Point | null;
  drawEnd: Point | null;
  ready: boolean;
  canUndo: boolean;
  canRedo: boolean;
  currentShapes: SketchElement[];
  shiftRef: React.MutableRefObject<boolean>;

  setTool: (t: SketchToolType) => void;
  setSnap: (s: boolean) => void;
  setSid: (s: string | null) => void;
  setPageIdx: (i: number) => void;
  setIsDrawing: (d: boolean) => void;
  setDrawStart: (p: Point | null) => void;
  setDrawEnd: (p: Point | null) => void;
  setPages: (p: SketchPage[]) => void;

  addShape: (shape: SketchElement) => void;
  deleteShape: (id: string) => void;
  deleteLast: () => void;
  clearAll: () => void;
  updateElementPosition: (id: string, absX: number, absY: number) => void;
  updateElementTransform: (id: string, scaleX: number, scaleY: number, rotation: number) => void;

  undo: () => void;
  redo: () => void;

  addPage: () => void;
  removePage: (pageId: number) => void;
  renamePage: (pageId: number, name: string) => void;

  buildPayload: () => unknown;

  snapCoord: (v: number) => number;
  snapNear: (v: number) => number;
}

export function useSketchState(
  sketch: unknown,
  onChange: (v: unknown) => void,
  readOnly: boolean,
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
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

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
      if (JSON.stringify(prev) === JSON.stringify(pp)) return prev;
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
  }, [pages, pageIdx, persist]);

  const deleteLast = useCallback(() => {
    const current = pages[pageIdx]?.elements || [];
    if (current.length === 0) return;
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: p.elements.slice(0, -1) } : p,
    );
    setSid(null);
    persist(next);
  }, [pages, pageIdx, persist]);

  const clearAll = useCallback(() => {
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: [] } : p,
    );
    setSid(null);
    persist(next);
  }, [pages, pageIdx, persist]);

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
      return { ...shape, x: absX, y: absY };
    });
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: updatedShapes } : p,
    );
    persist(next);
  }, [pages, pageIdx, persist]);

  const updateElementTransform = useCallback((id: string, scaleX: number, scaleY: number, rotation: number) => {
    const updatedShapes = pages[pageIdx].elements.map((el) => {
      if (el.id !== id) return el;
      if (el.type === 'line') return { ...el };
      if (el.type === 'text') return { ...el, rotation };
      return {
        ...el,
        width: Math.max(5, (el.width || 0) * scaleX),
        height: Math.max(5, (el.height || 0) * scaleY),
        rotation,
      };
    });
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: updatedShapes } : p,
    );
    persist(next);
  }, [pages, pageIdx, persist]);

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
  }, [historyIndex, history, onChange]);

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
  }, [historyIndex, history, onChange]);

const addPage = useCallback(() => {
    const name = prompt('Nombre de la p\u00e1gina:', `P\u00e1gina ${pages.length + 1}`);
    if (!name || !name.trim()) return;
    const newPage: SketchPage = { id: pid(), name: name.trim(), elements: [] };
    const next = [...pages, newPage];
    setPages(next);
    setPageIdx(next.length - 1);
    setSid(null);
    onChange(savePayload(next));
  }, [pages, onChange]);

  const removePage = useCallback((pageId: number) => {
    if (pages.length <= 1) return;
    const next = pages.filter((p) => p.id !== pageId);
    const newIdx = Math.min(pageIdx, next.length - 1);
    setPages(next);
    setPageIdx(newIdx);
    setSid(null);
    onChange(savePayload(next));
  }, [pages, pageIdx, onChange]);

  const renamePage = useCallback((pageId: number, name: string) => {
    if (!name.trim()) return;
    const next = pages.map((p) =>
      p.id === pageId ? { ...p, name: name.trim() } : p,
    );
    setPages(next);
    onChange(savePayload(next));
  }, [pages, onChange]);

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

    buildPayload,

    snapCoord: (v: number) => snapCoord(v, snap),
    snapNear: (v: number) => snapNear(v, snap),
  };
}