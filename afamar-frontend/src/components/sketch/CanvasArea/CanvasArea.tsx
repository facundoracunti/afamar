import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { SketchToolType, SketchElement, SketchPage, Point } from '@/types/sketch';
import { SketchPreviewLayer } from '../SketchPreviewLayer/SketchPreviewLayer';
import { STAGE_W, STAGE_H } from './CanvasArea.geometry';
import { buildGridLines } from './CanvasArea.grid';
import { renderCanvasShapes } from './CanvasArea.shapes';
import { useCanvasHandlers } from './CanvasArea.handlers';
import styles from './CanvasArea.module.css';

const s = styles as unknown as Record<string, string>;

interface CanvasAreaProps {
  tool: SketchToolType;
  snap: boolean;
  sid: string | null;
  isDrawing: boolean;
  drawStart: Point | null;
  drawEnd: Point | null;
  currentShapes: SketchElement[];
  readOnly: boolean;
  shiftRef: React.MutableRefObject<boolean>;
  pageIdx: number;
  pages: SketchPage[];

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

/** Konva stage of the croquis editor.
 *
 *  This file is the ORCHESTRATOR (see ADR 0009): the stage wiring lives
 *  here while each concern is delegated to a focused sub-module:
 *
 *   - `CanvasArea.geometry.ts` — stage constants + clamping + id minting.
 *   - `CanvasArea.grid.tsx`     — decorative background grid.
 *   - `CanvasArea.shapes.tsx`   — element → Konva shape rendering.
 *   - `CanvasArea.handlers.ts`  — pointer interaction (draw / drag / resize).
 */
export default function CanvasArea({
  tool,
  snap,
  sid,
  isDrawing,
  drawStart,
  drawEnd,
  currentShapes,
  readOnly,
  shiftRef,
  pageIdx,
  pages,
  setSid,
  setIsDrawing,
  setDrawStart,
  setDrawEnd,
  addShape,
  updateElementPosition,
  updateElementTransform,
  snapCoord,
  snapNear,
}: CanvasAreaProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageScale, setStageScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      // Scale the stage down to fit its container (never up beyond 1:1).
      // The logical 0..STAGE_W coordinate space is preserved: Konva
      // multiplies pointer positions by the stage scale, so drawing,
      // dragging and the Transformer all keep working with stage coords.
      setStageScale(Math.min(1, w / STAGE_W));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (tool !== 'select') {
      trRef.current?.nodes([]);
      trRef.current?.getLayer()?.batchDraw();
      return;
    }
    const tr = trRef.current;
    const stage = tr?.getStage();
    if (!tr || !stage) return;
    if (!sid) {
      tr.nodes([]);
    } else {
      const node = stage.findOne('#' + sid);
      tr.nodes(node ? [node] : []);
    }
    tr.getLayer()?.batchDraw();
  }, [tool, sid, pages, pageIdx]);

  const {
    handleStageClick,
    handleShapeSelect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDragEnd,
    handleTransformEnd,
  } = useCanvasHandlers({
    tool,
    snap,
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
  });

  const gridLines = buildGridLines();

  return (
    <div ref={containerRef} className={s['canvas-area']}>
      <Stage
        ref={stageRef}
        width={STAGE_W}
        height={STAGE_H}
        scaleX={stageScale}
        scaleY={stageScale}
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          cursor: readOnly ? 'default' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair',
          display: 'block',
        }}
      >
        <Layer listening={false}>
          <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#ffffff" />
          {gridLines}
        </Layer>
        <Layer>
          {renderCanvasShapes({
            currentShapes,
            tool,
            onDragEnd: handleDragEnd,
            onTransformEnd: handleTransformEnd,
            onSelect: handleShapeSelect,
          })}

          <SketchPreviewLayer
            tool={tool as 'line' | 'rect' | 'cutout' | 'circle' | 'select' | 'text'}
            isDrawing={isDrawing}
            drawStart={drawStart}
            drawEnd={drawEnd}
          />

          {tool === 'select' && sid && (
            <Transformer
              ref={trRef}
              boundBoxFunc={(o, n) => {
                const el = currentShapes.find((s) => s.id === sid);
                const isLineOrText = el?.type === 'line' || el?.type === 'text';
                if (isLineOrText) return n;
                return n.width < 10 || n.height < 10 ? o : n;
              }}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
