/**
 * `useSketchState` — public contract of the hook.
 */
import type {
  SketchToolType,
  SketchElement,
  SketchPage,
  Point,
} from '../../../types/sketch';

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
  updateElementTransform: (id: string, next: SketchElement) => void;

  undo: () => void;
  redo: () => void;

  addPage: () => void;
  removePage: (pageId: number) => void;
  renamePage: (pageId: number, name: string) => void;
  setPageMaterial: (pageId: number, material: string) => void;

  buildPayload: () => unknown;

  snapCoord: (v: number) => number;
  snapNear: (v: number) => number;
}
