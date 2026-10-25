/**
 * `CanvasArea` — pointer interaction handlers.
 *
 * Owns everything that reacts to the mouse on the Konva stage: selection,
 * shape creation (line / rect / cutout / circle), the inline text input of
 * the "text" tool, dragging and the Transformer resize/rotate bake.
 *
 * The geometry baked here is in STAGE coordinates (the logical 0..STAGE_W /
 * 0..STAGE_H space), never in screen pixels.
 */
import type Konva from 'konva';
import { useEffect, useRef } from 'react';
import type { SketchToolType, SketchElement, Point } from '@/types/sketch';
import { STAGE_W, STAGE_H, MIN_DIST, clampCoord, genId, logicalPointerPosition } from './CanvasArea.geometry';

export interface CanvasHandlers {
  handleStageClick: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  handleShapeSelect: (id: string) => void;
  handlePointerDown: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  handlePointerMove: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  handlePointerUp: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  handlePointerCancel: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  handleDragEnd: (e: Konva.KonvaEventObject<DragEvent>, id: string) => void;
  handleTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
}

export interface CanvasHandlerParams {
  tool: SketchToolType;
  snap: boolean;
  readOnly: boolean;
  isDrawing: boolean;
  drawStart: Point | null;
  drawEnd: Point | null;
  currentShapes: SketchElement[];
  shiftRef: React.MutableRefObject<boolean>;
  setSid: (id: string | null) => void;
  setIsDrawing: (v: boolean) => void;
  setDrawStart: (p: Point | null) => void;
  setDrawEnd: (p: Point | null) => void;
  addShape: (shape: SketchElement) => void;
  updateElementPosition: (id: string, offsetX: number, offsetY: number) => void;
  updateElementTransform: (id: string, next: SketchElement) => void;
  snapCoord: (v: number) => number;
  snapNear: (v: number) => number;
}

type PointerKonvaEvent = Konva.KonvaEventObject<PointerEvent>;

export function useCanvasHandlers(params: CanvasHandlerParams): CanvasHandlers {
  const {
    tool,
    readOnly,
    isDrawing,
    drawStart,
    drawEnd,
    currentShapes,
    shiftRef,
    setSid,
    setIsDrawing,
    setDrawStart,
    setDrawEnd,
    addShape,
    updateElementPosition,
    updateElementTransform,
    snapCoord,
    snapNear,
  } = params;

  const activePointerId = useRef<number | null>(null);

  const capturePointer = (stage: Konva.Stage, pointerId: number) => {
    const container = stage.container();
    if (typeof container.setPointerCapture === 'function') {
      try { container.setPointerCapture(pointerId); } catch { /* pointer may have ended */ }
    }
  };

  const releasePointer = (stage: Konva.Stage, pointerId: number) => {
    const container = stage.container();
    if (typeof container.releasePointerCapture === 'function' && container.hasPointerCapture(pointerId)) {
      try { container.releasePointerCapture(pointerId); } catch { /* pointer may have ended */ }
    }
  };

  const resetDrawing = () => {
    setIsDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
  };

  // A toolbar action can change the tool while a pointer is still pressed.
  // Drop that gesture so its pointerId cannot block the next interaction.
  useEffect(() => {
    if (tool === 'select' || readOnly) {
      activePointerId.current = null;
      if (isDrawing) {
        setIsDrawing(false);
        setDrawStart(null);
        setDrawEnd(null);
      }
    }
  }, [tool, readOnly, isDrawing, setIsDrawing, setDrawStart, setDrawEnd]);

  const ptr = (e: PointerKonvaEvent): Point => {
    const stage = e.target.getStage();
    const p = stage ? logicalPointerPosition(stage) : null;
    return p ? { x: snapNear(p.x), y: snapNear(p.y) } : { x: 0, y: 0 };
  };

  function resolveEnd(a: Point, b: Point): Point {
    if (!shiftRef.current) return b;
    return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
      ? { x: b.x, y: a.y }
      : { x: a.x, y: b.y };
  }

  const handleTextTool = (e: PointerKonvaEvent, stagePos: Point) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'fixed';
    input.style.left = `${e.evt.clientX}px`;
    input.style.top = `${e.evt.clientY - 24}px`;
    input.style.zIndex = '9999';
    input.style.padding = '4px 8px';
    input.style.border = '2px solid var(--color-primary, #3b82f6)';
    input.style.borderRadius = '6px';
    input.style.fontSize = '13px';
    input.style.width = '150px';
    input.style.background = 'var(--surface-bg, #fff)';
    input.style.outline = 'none';
    input.placeholder = 'Ej: 1.65 x 0.60';
    input.autofocus = true;

    const curAdd = addShape;

    const finish = (value: string | null) => {
      if (!document.body.contains(input)) return;
      if (value && value.trim()) {
        curAdd({
          id: genId(),
          type: 'text',
          x: clampCoord(snapCoord(stagePos.x), STAGE_W),
          y: clampCoord(snapCoord(stagePos.y), STAGE_H),
          text: value.trim(),
          fontSize: 16,
          fill: '#000',
        } as SketchElement);
      }
      input.remove();
    };

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(input.value); }
      if (ev.key === 'Escape') finish(null);
    });
    input.addEventListener('blur', () => setTimeout(() => finish(input.value), 180));

    document.body.appendChild(input);
    requestAnimationFrame(() => input.focus());
  };

  const handleStageClick = (e: PointerKonvaEvent) => {
    if (readOnly || tool !== 'select') return;
    if (e.target === e.target.getStage()) setSid(null);
  };

  const handleShapeSelect = (id: string) => {
    if (tool !== 'select') return;
    setSid(id);
  };

  const handlePointerDown = (e: PointerKonvaEvent) => {
    if (readOnly || tool === 'select') return;

    if (activePointerId.current !== null && activePointerId.current !== e.evt.pointerId) return;
    activePointerId.current = e.evt.pointerId;
    const stage = e.target.getStage();
    if (stage) capturePointer(stage, e.evt.pointerId);

    const pos = ptr(e);
    if (tool === 'text') { handleTextTool(e, pos); return; }

    const st = tool === 'line'
      ? { x: snapCoord(pos.x), y: snapCoord(pos.y) }
      : pos;
    setDrawStart(st);
    setDrawEnd(st);
    setIsDrawing(true);
  };

  const handlePointerMove = (e: PointerKonvaEvent) => {
    if (activePointerId.current !== e.evt.pointerId) return;
    if (readOnly || !isDrawing || !drawStart) return;
    const pos = ptr(e);
    setDrawEnd(tool === 'line' ? resolveEnd(drawStart, pos) : pos);
  };

  const handlePointerUp = (e: PointerKonvaEvent) => {
    if (activePointerId.current !== e.evt.pointerId) return;
    activePointerId.current = null;
    const stage = e.target.getStage();
    if (stage) releasePointer(stage, e.evt.pointerId);
    if (readOnly || !isDrawing || !drawStart || !drawEnd) {
      resetDrawing();
      return;
    }

    const dx = drawEnd.x - drawStart.x;
    const dy = drawEnd.y - drawStart.y;

    if (Math.abs(dx) <= MIN_DIST && Math.abs(dy) <= MIN_DIST) {
      resetDrawing();
      return;
    }

    const el: SketchElement = tool === 'line'
      ? {
          id: genId(),
          type: 'line',
          points: [
            clampCoord(snapCoord(drawStart.x), STAGE_W),
            clampCoord(snapCoord(drawStart.y), STAGE_H),
            clampCoord(snapCoord(drawEnd.x), STAGE_W),
            clampCoord(snapCoord(drawEnd.y), STAGE_H),
          ],
          stroke: '#000',
          strokeWidth: 2,
        } as SketchElement
      : tool === 'circle'
        ? {
            id: genId(),
            type: 'circle',
            cx: clampCoord(snapCoord(drawStart.x), STAGE_W),
            cy: clampCoord(snapCoord(drawStart.y), STAGE_H),
            radius: Math.max(1, Math.hypot(
              clampCoord(drawEnd.x, STAGE_W) - clampCoord(snapCoord(drawStart.x), STAGE_W),
              clampCoord(drawEnd.y, STAGE_H) - clampCoord(snapCoord(drawStart.y), STAGE_H),
            )),
            stroke: '#000',
            strokeWidth: 2,
          } as SketchElement
        : {
            id: genId(),
            type: tool === 'cutout' ? 'cutout' : 'rect',
            x: clampCoord(Math.min(drawStart.x, drawEnd.x), STAGE_W),
            y: clampCoord(Math.min(drawStart.y, drawEnd.y), STAGE_H),
            width: clampCoord(Math.abs(dx), STAGE_W),
            height: clampCoord(Math.abs(dy), STAGE_H),
            fill: 'transparent',
            stroke: tool === 'cutout' ? '#dc2626' : '#000',
            strokeWidth: 2,
            ...(tool === 'cutout' ? { dash: [4, 4] } : {}),
          } as SketchElement;

    addShape(el);
    resetDrawing();
  };

  const handlePointerCancel = (e: PointerKonvaEvent) => {
    if (activePointerId.current !== e.evt.pointerId) return;
    activePointerId.current = null;
    const stage = e.target.getStage();
    if (stage) releasePointer(stage, e.evt.pointerId);
    resetDrawing();
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    if (tool !== 'select' || readOnly) return;
    const node = e.target;
    const el = currentShapes.find((s) => s.id === id);

    if (el?.type === 'line') {
      // Lines store points in absolute stage coords while the Konva node
      // sits at (0,0). After drag, node.x()/node.y() is the SIGNED DELTA
      // from the original position — it can be NEGATIVE (dragging left/up).
      // We cannot clamp the delta itself (clampCoord(-50) → 0.5 would
      // force the line back to the right). Instead, clamp each resulting
      // ABSOLUTE point to [0.5, max-0.5] so the line stays on canvas while
      // remaining freely movable in both directions.
      const dx = node.x();
      const dy = node.y();
      const newPoints = el.points.map((p, idx) => {
        const max = idx % 2 === 0 ? STAGE_W : STAGE_H;
        return clampCoord(p + (idx % 2 === 0 ? dx : dy), max);
      });
      node.x(0);
      node.y(0);
      updateElementTransform(id, { ...el, points: newPoints, x: 0, y: 0 });
      return;
    }

    // For rects/circles/text the Konva node position IS the absolute
    // top-left/center, so clamping the value directly is correct.
    const newX = clampCoord(node.x(), STAGE_W);
    const newY = clampCoord(node.y(), STAGE_H);
    updateElementPosition(id, newX, newY);
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    if (readOnly) return;
    const node = e.target;
    const id = node.id();
    const el = currentShapes.find((s) => s.id === id);
    if (!el) return;

    // Capture the node's current matrix BEFORE resetting it. The Transformer
    // has applied scale + rotation + an anchor-compensation offset to the
    // node; the stored element geometry is still the pre-transform values.
    // "Baking" maps the local geometry through the absolute transform so the
    // scale actually survives (the old code discarded it for lines/text,
    // which made them jump/flip and prevented text from growing).
    const absTransform = node.getAbsoluteTransform();

    let baked: SketchElement | null = null;

    if (el.type === 'line') {
      const pts: number[] = [];
      for (let i = 0; i < el.points.length; i += 2) {
        const p = absTransform.point({ x: el.points[i], y: el.points[i + 1] });
        pts.push(clampCoord(p.x, STAGE_W), clampCoord(p.y, STAGE_H));
      }
      baked = { ...el, points: pts, x: 0, y: 0 };
    } else if (el.type === 'text') {
      const k = Math.min(Math.abs(node.scaleX()), Math.abs(node.scaleY())) || 1;
      const topLeft = absTransform.point({ x: 0, y: 0 });
      baked = {
        ...el,
        x: clampCoord(topLeft.x, STAGE_W),
        y: clampCoord(topLeft.y, STAGE_H),
        fontSize: Math.max(6, Math.round((el.fontSize || 16) * k)),
        rotation: node.rotation(),
      };
    } else if (el.type === 'circle') {
      const k = Math.min(Math.abs(node.scaleX()), Math.abs(node.scaleY())) || 1;
      const center = absTransform.point({ x: 0, y: 0 });
      baked = {
        ...el,
        cx: clampCoord(center.x, STAGE_W),
        cy: clampCoord(center.y, STAGE_H),
        radius: Math.max(4, Math.round((el.radius || 40) * k)),
      };
    } else if (el.type === 'rect' || el.type === 'cutout') {
      const topLeft = absTransform.point({ x: 0, y: 0 });
      baked = {
        ...el,
        x: clampCoord(topLeft.x, STAGE_W),
        y: clampCoord(topLeft.y, STAGE_H),
        width: Math.max(5, Math.round((el.width || 0) * Math.abs(node.scaleX()))),
        height: Math.max(5, Math.round((el.height || 0) * Math.abs(node.scaleY()))),
        rotation: node.rotation(),
      };
    }

    // Reset the node back to identity so the baked geometry is authoritative
    // (otherwise the transformer scale/position would double-apply on re-render).
    node.scaleX(1);
    node.scaleY(1);
    node.rotation(0);
    node.x(0);
    node.y(0);
    node.getLayer()?.batchDraw();

    if (baked) updateElementTransform(id, baked);
  };

  return {
    handleStageClick,
    handleShapeSelect,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleDragEnd,
    handleTransformEnd,
  };
}
