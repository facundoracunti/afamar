import React, { useEffect, useRef } from 'react';
import { Stage, Layer, Line, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { SketchToolType, SketchElement, SketchPage, Point } from '@/types/sketch';
import LineShape from '../LineShape/LineShape';
import RectangleShape from '../RectangleShape/RectangleShape';
import TextShape from '../TextShape/TextShape';
import { SketchPreviewLayer } from '../SketchPreviewLayer/SketchPreviewLayer';
import { SKETCH_STAGE_WIDTH, SKETCH_STAGE_HEIGHT } from '../../../constants';
import styles from './CanvasArea.module.css';

const s = styles as unknown as Record<string, string>;

const GRID = 20;
const STAGE_W = SKETCH_STAGE_WIDTH;
const STAGE_H = SKETCH_STAGE_HEIGHT;
const MIN_DIST = 4;

function clampCoord(v: number, max: number): number {
  return Math.max(0.5, Math.min(max - 0.5, v));
}

let _tid = 0;
function genId(): string {
  return `e${Date.now().toString(36)}_${++_tid}`;
}

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
  updateElementTransform: (id: string, scaleX: number, scaleY: number, rotation: number) => void;

  snapCoord: (v: number) => number;
  snapNear: (v: number) => number;
}

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

  const ptr = (e: Konva.KonvaEventObject<MouseEvent>): Point => {
    const p = e.target.getStage()?.getPointerPosition();
    return p ? { x: snapNear(p.x), y: snapNear(p.y) } : { x: 0, y: 0 };
  };

  function resolveEnd(a: Point, b: Point): Point {
    if (!shiftRef.current) return b;
    return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
      ? { x: b.x, y: a.y }
      : { x: a.x, y: b.y };
  }

  const handleTextTool = (e: Konva.KonvaEventObject<MouseEvent>, stagePos: Point) => {
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

    const snapOn = snap;
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

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly || tool !== 'select') return;
    if (e.target === e.target.getStage()) setSid(null);
  };

  const handleShapeSelect = (id: string) => {
    if (tool !== 'select') return;
    setSid(id);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly || tool === 'select') return;

    const pos = ptr(e);
    if (tool === 'text') { handleTextTool(e, pos); return; }

    const st = tool === 'line'
      ? { x: snapCoord(pos.x), y: snapCoord(pos.y) }
      : pos;
    setDrawStart(st);
    setDrawEnd(st);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly || !isDrawing || !drawStart) return;
    const pos = ptr(e);
    setDrawEnd(tool === 'line' ? resolveEnd(drawStart, pos) : pos);
  };

  const handleMouseUp = () => {
    if (readOnly || !isDrawing || !drawStart || !drawEnd) return;

    const dx = drawEnd.x - drawStart.x;
    const dy = drawEnd.y - drawStart.y;

    if (Math.abs(dx) <= MIN_DIST && Math.abs(dy) <= MIN_DIST) {
      setIsDrawing(false);
      setDrawStart(null);
      setDrawEnd(null);
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
    setIsDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    if (tool !== 'select' || readOnly) return;
    const node = e.target;
    const newX = clampCoord(node.x(), STAGE_W);
    const newY = clampCoord(node.y(), STAGE_H);

    updateElementPosition(id, newX, newY);

    node.x(0);
    node.y(0);
    node.getLayer()?.batchDraw();
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    if (readOnly) return;
    const node = e.target;
    const id = node.id();
    updateElementTransform(id, node.scaleX(), node.scaleY(), node.rotation());
    node.scaleX(1);
    node.scaleY(1);
  };

  const gridLines: React.ReactElement[] = [];
  for (let x = 0; x <= STAGE_W; x += GRID) {
    const m = x % (GRID * 5) === 0;
    gridLines.push(
      <Line key={`gv${x}`} points={[x, 0, x, STAGE_H]} stroke={m ? '#d4d4d4' : '#e8e8e8'} strokeWidth={m ? 0.8 : 0.5} listening={false} />,
    );
  }
  for (let y = 0; y <= STAGE_H; y += GRID) {
    const m = y % (GRID * 5) === 0;
    gridLines.push(
      <Line key={`gh${y}`} points={[0, y, STAGE_W, y]} stroke={m ? '#d4d4d4' : '#e8e8e8'} strokeWidth={m ? 0.8 : 0.5} listening={false} />,
    );
  }

  return (
    <div className={s['canvas-area']}>
      <Stage
        ref={stageRef}
        width={STAGE_W}
        height={STAGE_H}
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
          {currentShapes.map((el) => {
            const isDraggable = tool === 'select';

            if (el.type === 'line') {
              return (
                <LineShape
                  key={el.id}
                  element={el}
                  isDraggable={isDraggable}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                  onSelect={handleShapeSelect}
                />
              );
            }

            if (el.type === 'rect' || el.type === 'cutout') {
              return (
                <RectangleShape
                  key={el.id}
                  element={el}
                  isDraggable={isDraggable}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                  onSelect={handleShapeSelect}
                />
              );
            }

            if (el.type === 'text') {
              return (
                <TextShape
                  key={el.id}
                  element={el}
                  isDraggable={isDraggable}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                  onSelect={handleShapeSelect}
                />
              );
            }

            return null;
          })}

          <SketchPreviewLayer
            tool={tool as 'line' | 'rect' | 'cutout' | 'select' | 'text'}
            isDrawing={isDrawing}
            drawStart={drawStart}
            drawEnd={drawEnd}
          />

          {tool === 'select' && sid && (
            <Transformer
              ref={trRef}
              boundBoxFunc={(o, n) => (n.width < 10 || n.height < 10 ? o : n)}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
