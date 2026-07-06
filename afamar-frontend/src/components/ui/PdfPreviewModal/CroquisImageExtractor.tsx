/**
 * Render the croquis pages into a hidden Konva Stage and emit one PNG
 * data-URI per page via `stage.toDataURL()`.
 *
 * The croquis data lives in `form.sketch_elements` as the `savePayload()`
 * shape produced by `useCroquisState`:
 *   `[{ pagina_id, name, dibujo: CroquisElement[] }, ...]`
 *
 * We re-render the same shapes (Line / Rect / Cutout / Text) into a hidden
 * Stage so the PDF can embed them as raster images. Konva requires the
 * Stage to be in the DOM with valid dimensions, so we use
 * `position:absolute; left:-9999px` (not `display:none`) — the canvas is
 * laid out but never visible.
 */
import React, { useEffect, useRef } from 'react';
import { Stage, Layer, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CroquisElement, CroquisPage } from '../../../types/croquis';

const STAGE_W = 800;
const STAGE_H = 600;

interface CroquisImageExtractorProps {
  sketchElements: unknown;
  onReady: (images: string[]) => void;
}

/** Normalize the sketch data into pages of elements.
 *  Accepts three shapes:
 *  1. Editor format: `[{ pagina_id, name, dibujo: [...] }, ...]` (from useEntityForm)
 *  2. Backend format: `[{ type, data, order }, ...]` (flat list from GET /budgets/{id})
 *  3. Legacy: `{ pages: [{ elements: [...] }] }` */
function normalizePages(raw: unknown): CroquisPage[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Detect backend flat list: each item has `type` + `data` but no `dibujo`/`elements`
  const looksLikeFlatElements = raw.every(
    (item) => item && typeof item === 'object' && 'type' in item && !('dibujo' in item) && !('elements' in item),
  );
  if (looksLikeFlatElements) {
    const elements = raw.map((item) => {
      const obj = item as Record<string, unknown>;
      const { type, data, ...rest } = obj;
      void data;
      let parsed: Record<string, unknown> = {};
      if (typeof data === 'string' && data.length > 0) {
        try { parsed = JSON.parse(data) as Record<string, unknown>; } catch { parsed = {}; }
      } else if (data && typeof data === 'object') {
        parsed = data as Record<string, unknown>;
      }
      return { ...parsed, type } as unknown as CroquisElement;
    });
    return [{ id: 1, name: 'Página 1', elements }];
  }

  const pages: CroquisPage[] = [];
  for (const p of raw as Record<string, unknown>[]) {
    const dibujo = (p.dibujo || p.elements || []) as CroquisElement[];
    if (!Array.isArray(dibujo)) continue;
    pages.push({
      id: (p.pagina_id as number) || 0,
      name: (p.name as string) || (p.nombre as string) || 'Página',
      elements: dibujo,
    });
  }
  return pages;
}

function renderElement(el: CroquisElement, key: string): React.ReactNode {
  if (el.type === 'line') {
    const points = el.points || [];
    return (
      <Line
        key={key}
        points={points}
        stroke={el.stroke || '#000'}
        strokeWidth={el.strokeWidth || 2}
        dash={el.dash}
        x={el.x}
        y={el.y}
      />
    );
  }
  if (el.type === 'text') {
    return (
      <Text
        key={key}
        x={el.x}
        y={el.y}
        text={el.text || ''}
        fontSize={el.fontSize || 16}
        fill={el.fill || '#000'}
        rotation={el.rotation}
      />
    );
  }
  // rect | cutout
  return (
    <Rect
      key={key}
      x={el.x}
      y={el.y}
      width={el.width || 80}
      height={el.height || 50}
      fill={el.fill === 'transparent' ? undefined : el.fill}
      stroke={el.stroke || '#000'}
      strokeWidth={el.strokeWidth || 2}
      dash={el.dash}
      rotation={el.rotation}
    />
  );
}

export default function CroquisImageExtractor({ sketchElements, onReady }: CroquisImageExtractorProps) {
  const pages = normalizePages(sketchElements);
  const stageRefs = useRef<(Konva.Stage | null)[]>([]);

  useEffect(() => {
    // Wait one frame so Konva has finished laying out the shapes.
    const raf = requestAnimationFrame(() => {
      const images: string[] = [];
      for (let i = 0; i < pages.length; i += 1) {
        const stage = stageRefs.current[i];
        if (!stage) continue;
        try {
          const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });
          if (dataUrl && dataUrl.length > 0) images.push(dataUrl);
        } catch {
          // skip pages that fail to render (e.g., empty or broken)
        }
      }
      onReady(images);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketchElements]);

  if (pages.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: -9999,
        top: 0,
        width: STAGE_W,
        height: STAGE_H,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {pages.map((page, idx) => (
        <Stage
          key={page.id || idx}
          ref={(node) => {
            stageRefs.current[idx] = node;
          }}
          width={STAGE_W}
          height={STAGE_H}
        >
          <Layer>
            {page.elements.map((el, i) => renderElement(el, `${page.id}-${i}`))}
          </Layer>
        </Stage>
      ))}
    </div>
  );
}
