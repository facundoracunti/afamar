/**
 * `CanvasArea` — background grid.
 *
 * Purely decorative lines (every 20px, with a heavier line every 100px) drawn
 * on the non-interactive layer under the shapes.
 */
import React from 'react';
import { Line } from 'react-konva';
import { GRID, STAGE_W, STAGE_H } from './CanvasArea.geometry';

/** Builds the grid lines of the stage background. */
export function buildGridLines(): React.ReactElement[] {
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
  return gridLines;
}
