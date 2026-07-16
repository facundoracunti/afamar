import React from 'react';
import { Line, Rect } from 'react-konva';
import type { Point } from '@/types/sketch';

interface SketchPreviewLayerProps {
  tool: 'line' | 'rect' | 'cutout' | 'select' | 'text';
  isDrawing: boolean;
  drawStart: Point | null;
  drawEnd: Point | null;
}

export function SketchPreviewLayer({ tool, isDrawing, drawStart, drawEnd }: SketchPreviewLayerProps) {
  if (!isDrawing || !drawStart || !drawEnd) return null;

  if (tool === 'line') {
    return (
      <Line
        points={[drawStart.x, drawStart.y, drawEnd.x, drawEnd.y]}
        stroke="#3b82f6"
        strokeWidth={1.5}
        dash={[6, 4]}
        listening={false}
      />
    );
  }

  if (tool === 'rect' || tool === 'cutout') {
    return (
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
    );
  }

  return null;
}
