/**
 * `useSketchState` — wire → editor normalization.
 *
 * The croquis arrives from the backend in several legacy shapes (flat
 * element list, per-page `pagina_id`/`dibujo`, `cutout`/`bacha`/`anafe`,
 * `x1/y1/x2/y2` lines, `path`, `measure`, `circle`, `hole`…). `normEls` and
 * `normPages` translate ALL of them into the single editor shape
 * (`SketchPage[]` / `SketchElement[]`), filling in defaults.
 *
 * Both sides of the re-init guard in `useSketchState` MUST go through this
 * same pipeline — see the comment on `canonicalJSON` in
 * `useSketchState.persistence.ts`.
 */
import type {
  SketchElement,
  SketchLine,
  SketchRect,
  SketchCutout,
  SketchCircle,
  SketchText,
  SketchPage,
  RawElement,
} from '../../../types/sketch';
import { uid, pid } from './useSketchState.ids';

/** Normalizes a raw element (any legacy flavour) to the editor shape. */
export function normEls(arr: RawElement[]): SketchElement[] {
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

    if (t === 'circle') {
      return {
        id,
        type: 'circle',
        cx: (el.cx as number) ?? (el.x as number) ?? 0,
        cy: (el.cy as number) ?? (el.y as number) ?? 0,
        radius: (el.radius as number) ?? (el.r as number) ?? 40,
        stroke: (el.stroke as string) || '#000',
        strokeWidth: (el.strokeWidth as number) ?? 2,
        dash: (el.dash as number[] | undefined) || undefined,
      } as SketchCircle;
    }

    if (t === 'hole') {
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

/** Normalizes the incoming croquis wire into the editor's page list.
 *
 *  Accepts the legacy flat element list (single page) and the modern
 *  per-page wire (`pagina_id` / `nombre` / `material` / `dibujo`). */
export function normPages(sketch: unknown): SketchPage[] {
  if (!Array.isArray(sketch) || !sketch.length) {
    return [{ id: pid(), name: 'Página 1', elements: [] }];
  }
  if (!sketch[0]?.pagina_id) {
    return [{ id: pid(), name: 'Página 1', elements: normEls(sketch as RawElement[]) }];
  }
  return sketch.map((p: Record<string, unknown>, i: number): SketchPage => ({
    id: (p.pagina_id as number) || pid(),
    name: (p.nombre as string) || (p.name as string) || `Página ${i + 1}`,
    material: ((p.material as string) || '').trim() || undefined,
    elements: normEls((p.dibujo || p.elements || []) as RawElement[]),
  }));
}
