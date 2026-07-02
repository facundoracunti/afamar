import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CroquisToolType,
  CroquisElement,
  CroquisLine,
  CroquisRect,
  CroquisCutout,
  CroquisText,
  CroquisPage,
  Point,
  RawElement,
} from '../../../types/croquis';

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

function normEls(arr: RawElement[]): CroquisElement[] {
  return arr.map((el): CroquisElement => {
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
      } as CroquisLine;
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
      } as CroquisRect;
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
      } as CroquisCutout;
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
      } as CroquisText;
    }

    if (t === 'line' && typeof el.x1 === 'number') {
      return {
        id,
        type: 'line',
        points: [el.x1 as number, el.y1 as number, el.x2 as number, el.y2 as number],
        stroke: (el.color as string) || '#000',
        strokeWidth: 2,
      } as CroquisLine;
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
      } as CroquisLine;
    }

    if (t === 'measure') {
      return {
        id,
        type: 'line',
        points: [el.x1 as number, el.y1 as number, el.x2 as number, el.y2 as number],
        stroke: '#000',
        strokeWidth: 1.5,
      } as CroquisLine;
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
      } as CroquisCutout;
    }

    return { id, type: (t || 'rect') as CroquisElement['type'], x: 0, y: 0, width: 80, height: 50, fill: 'transparent', stroke: '#000', strokeWidth: 2 } as CroquisElement;
  });
}

function normPages(croquis: unknown): CroquisPage[] {
  if (!Array.isArray(croquis) || !croquis.length) {
    return [{ id: pid(), nombre: 'Página 1', elementos: [] }];
  }
  if (!croquis[0]?.pagina_id) {
    return [{ id: pid(), nombre: 'Página 1', elementos: normEls(croquis as RawElement[]) }];
  }
  return croquis.map((p: Record<string, unknown>, i: number): CroquisPage => ({
    id: (p.pagina_id as number) || pid(),
    nombre: (p.nombre as string) || `Página ${i + 1}`,
    elementos: normEls((p.dibujo || p.elementos || []) as RawElement[]),
  }));
}

function savePayload(pages: CroquisPage[]): unknown {
  return pages.map((p) => ({
    pagina_id: p.id,
    nombre: p.nombre,
    dibujo: p.elementos.map(({ id, ...rest }) => ({ ...rest, id })),
  }));
}

function clonePages(pages: CroquisPage[]): CroquisPage[] {
  return pages.map((p) => ({ ...p, elementos: p.elementos.map((el) => ({ ...el })) }));
}

export interface UseCroquisStateReturn {
  pages: CroquisPage[];
  pageIdx: number;
  tool: CroquisToolType;
  snap: boolean;
  sid: string | null;
  isDrawing: boolean;
  drawStart: Point | null;
  drawEnd: Point | null;
  ready: boolean;
  canUndo: boolean;
  canRedo: boolean;
  currentShapes: CroquisElement[];
  shiftRef: React.MutableRefObject<boolean>;

  setTool: (t: CroquisToolType) => void;
  setSnap: (s: boolean) => void;
  setSid: (s: string | null) => void;
  setPageIdx: (i: number) => void;
  setIsDrawing: (d: boolean) => void;
  setDrawStart: (p: Point | null) => void;
  setDrawEnd: (p: Point | null) => void;
  setPages: (p: CroquisPage[]) => void;

  addShape: (shape: CroquisElement) => void;
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

export function useCroquisState(
  croquis: unknown,
  onChange: (v: unknown) => void,
  readOnly: boolean,
): UseCroquisStateReturn {
  const [pages, setPages] = useState<CroquisPage[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<CroquisToolType>('select');
  const [snap, setSnap] = useState(true);
  const [sid, setSid] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawEnd, setDrawEnd] = useState<Point | null>(null);
  const [history, setHistory] = useState<CroquisPage[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const shiftRef = useRef(false);

  const currentShapes = pages[pageIdx]?.elementos || [];
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const persist = useCallback((updatedPages: CroquisPage[]) => {
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
    const pp = normPages(croquis);
    setPages(pp);
    setPageIdx(0);
    setSid(null);
    setReady(true);
    setHistory([clonePages(pp)]);
    setHistoryIndex(0);
  }, [croquis]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const buildPayload = useCallback((): unknown => savePayload(pages), [pages]);

  const addShape = useCallback((shape: CroquisElement) => {
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elementos: [...p.elementos, shape] } : p,
    );
    persist(next);
  }, [pages, pageIdx, persist]);

  const deleteShape = useCallback((id: string) => {
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elementos: p.elementos.filter((el) => el.id !== id) } : p,
    );
    setSid(null);
    persist(next);
  }, [pages, pageIdx, persist]);

  const deleteLast = useCallback(() => {
    const current = pages[pageIdx]?.elementos || [];
    if (current.length === 0) return;
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elementos: p.elementos.slice(0, -1) } : p,
    );
    setSid(null);
    persist(next);
  }, [pages, pageIdx, persist]);

  const clearAll = useCallback(() => {
    const next = pages.map((p, i) =>
      i === pageIdx ? { ...p, elementos: [] } : p,
    );
    setSid(null);
    persist(next);
  }, [pages, pageIdx, persist]);

  const updateElementPosition = useCallback((id: string, absX: number, absY: number) => {
    const updatedShapes = pages[pageIdx].elementos.map((shape) => {
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
      i === pageIdx ? { ...p, elementos: updatedShapes } : p,
    );
    persist(next);
  }, [pages, pageIdx, persist]);

  const updateElementTransform = useCallback((id: string, scaleX: number, scaleY: number, rotation: number) => {
    const updatedShapes = pages[pageIdx].elementos.map((el) => {
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
      i === pageIdx ? { ...p, elementos: updatedShapes } : p,
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
    const name = prompt('Nombre de la página:', `Página ${pages.length + 1}`);
    if (!name || !name.trim()) return;
    const newPage: CroquisPage = { id: pid(), nombre: name.trim(), elementos: [] };
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
      p.id === pageId ? { ...p, nombre: name.trim() } : p,
    );
    setPages(next);
    onChange(savePayload(next));
  }, [pages, onChange]);

  const handleSetTool = useCallback((t: CroquisToolType) => {
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
