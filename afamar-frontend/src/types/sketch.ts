export type SketchToolType = 'select' | 'line' | 'rect' | 'cutout' | 'text';

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

export type SketchElement = SketchLine | SketchRect | SketchCutout | SketchText;

export interface SketchPage {
  id: number;
  name: string;
  elements: SketchElement[];
}

export interface SketchEditorProps {
  sketch: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}

export type RawElement = Record<string, unknown>;