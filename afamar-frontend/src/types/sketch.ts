export type SketchToolType = 'select' | 'line' | 'rect' | 'cutout' | 'circle' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface SketchLine {
  id: string;
  type: 'line';
  points: number[];
  x?: number;
  y?: number;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
}

export interface SketchRect {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  rotation?: number;
}

export interface SketchCutout {
  id: string;
  type: 'cutout';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: number[];
  rotation?: number;
}

export interface SketchText {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  rotation?: number;
}

/** Circle drawn with the "Círculo" tool (round bathtubs / grifería).
 *  `cx`/`cy` is the CENTER of the circle (Konva `Circle` is center-based). */
export interface SketchCircle {
  id: string;
  type: 'circle';
  cx: number;
  cy: number;
  radius: number;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
}

export type SketchElement = SketchLine | SketchRect | SketchCutout | SketchText | SketchCircle;

export interface SketchPage {
  id: number;
  name: string;
  elements: SketchElement[];
  /** Material this page's drawing belongs to (e.g. "GRIS MARA"). Optional —
   *  used to label each croquis page on the taller sheet PDF. */
  material?: string;
}

export interface SketchEditorProps {
  sketch: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  /** Unique material names available to label each page ('' = none). */
  materials?: string[];
}

export type RawElement = Record<string, unknown>;