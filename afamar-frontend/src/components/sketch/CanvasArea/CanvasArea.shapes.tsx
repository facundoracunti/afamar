/**
 * `CanvasArea` — shape rendering.
 *
 * Maps the editor elements to their Konva shape components. Only the
 * "select" tool makes the shapes draggable.
 *
 * Exposed as a plain render function (NOT a component) on purpose: the
 * result is spliced directly into the Konva `<Layer>` children, exactly
 * like the previous inline `.map()` — no extra React node (fragment /
 * wrapper group) is introduced into the Konva tree.
 */
import React from 'react';
import type Konva from 'konva';
import type { SketchElement, SketchToolType } from '@/types/sketch';
import LineShape from '../LineShape/LineShape';
import RectangleShape from '../RectangleShape/RectangleShape';
import TextShape from '../TextShape/TextShape';
import CircleShape from '../CircleShape/CircleShape';

export interface CanvasShapesOptions {
  currentShapes: SketchElement[];
  tool: SketchToolType;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>, id: string) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  onSelect: (id: string) => void;
}

/** Renders the editor elements as their Konva shape components. */
export function renderCanvasShapes({
  currentShapes,
  tool,
  onDragEnd,
  onTransformEnd,
  onSelect,
}: CanvasShapesOptions): React.ReactElement[] {
  return currentShapes.map((el) => {
    const isDraggable = tool === 'select';

    if (el.type === 'line') {
      return (
        <LineShape
          key={el.id}
          element={el}
          isDraggable={isDraggable}
          onDragEnd={onDragEnd}
          onTransformEnd={onTransformEnd}
          onSelect={onSelect}
        />
      );
    }

    if (el.type === 'rect' || el.type === 'cutout') {
      return (
        <RectangleShape
          key={el.id}
          element={el}
          isDraggable={isDraggable}
          onDragEnd={onDragEnd}
          onTransformEnd={onTransformEnd}
          onSelect={onSelect}
        />
      );
    }

    if (el.type === 'text') {
      return (
        <TextShape
          key={el.id}
          element={el}
          isDraggable={isDraggable}
          onDragEnd={onDragEnd}
          onTransformEnd={onTransformEnd}
          onSelect={onSelect}
        />
      );
    }

    if (el.type === 'circle') {
      return (
        <CircleShape
          key={el.id}
          element={el}
          isDraggable={isDraggable}
          onDragEnd={onDragEnd}
          onTransformEnd={onTransformEnd}
          onSelect={onSelect}
        />
      );
    }

    return null;
  }) as React.ReactElement[];
}
