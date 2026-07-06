import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { SketchToolType, SketchElement, SketchPage, Point } from '@/types/sketch';
import LineShape from '../LineShape/LineShape';
import RectangleShape from '../RectangleShape/RectangleShape';
import TextShape from '../TextShape/TextShape';

const GRID = 20;
const STAGE_H = 600;
const MIN_DIST = 4;

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
  const [stageW, setStageW] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setStageW(w);
    });
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
    input.style.border = '2px solid #3b82f6';
    input.style.borderRadius = '6px';
    input.style.fontSize = '13px';
    input.style.width = '150px';
    input.style.background = '#fff';
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
          x: snapCoord(stagePos.x),
          y: snapCoord(stagePos.y),
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

    const s = tool === 'line'
      ? { x: snapCoord(pos.x), y: snapCoord(pos.y) }
      : pos;
    setDrawStart(s);
    setDrawEnd(s);
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
          points: [snapCoord(drawStart.x), snapCoord(drawStart.y), snapCoord(drawEnd.x), snapCoord(drawEnd.y)],
          stroke: '#000',
          strokeWidth: 2,
        } as SketchElement
      : {
          id: genId(),
          type: tool === 'cutout' ? 'cutout' : 'rect',
          x: Math.min(drawStart.x, drawEnd.x),
          y: Math.min(drawStart.y, drawEnd.y),
          width: Math.abs(dx),
          height: Math.abs(dy),
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
    const newX = node.x();
    const newY = node.y();

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
  for (let x = 0; x <= stageW; x += GRID) {
    const m = x % (GRID * 5) === 0;
    gridLines.push(
      <Line key={`gv${x}`} points={[x, 0, x, STAGE_H]} stroke={m ? '#d4d4d4' : '#e8e8e8'} strokeWidth={m ? 0.8 : 0.5} listening={false} />,
    );
  }
  for (let y = 0; y <= STAGE_H; y += GRID) {
    const m = y % (GRID * 5) === 0;
    gridLines.push(
      <Line key={`gh${y}`} points={[0, y, stageW, y]} stroke={m ? '#d4d4d4' : '#e8e8e8'} strokeWidth={m ? 0.8 : 0.5} listening={false} />,
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Stage
        ref={stageRef}
        width={stageW}
        height={STAGE_H}
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          cursor: readOnly ? 'default' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair',
        }}
      >
        <Layer listening={false}>
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

          {tool === 'line' && isDrawing && drawStart && drawEnd && (
            <Line
              points={[drawStart.x, drawStart.y, drawEnd.x, drawEnd.y]}
              stroke="#3b82f6"
              strokeWidth={1.5}
              dash={[6, 4]}
              listening={false}
            />
          )}

          {(tool === 'rect' || tool === 'cutout') && isDrawing && drawStart && drawEnd && (
            <Rect
              x={Math.min(drawStart.x, drawEnd.x)}
              y={Math.min(drawStart.y, drawEnd.y)}
              width={Math.abs(drawEnd.x - drawStart.x)}
              height={Math.abs(drawEnd.y - drawStart.y)}
              stroke="#3b82f6"
              strokeWidth={1.5}
              dash={[6, 4]}
              fill="transparent"
              listening={false}
            />
          )}

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