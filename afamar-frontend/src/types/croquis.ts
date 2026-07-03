export type CroquisToolType = 'select' | 'line' | 'rect' | 'cutout' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface CroquisLine {
  id: string;
  type: 'line';
  points: number[];
  x?: number;
  y?: number;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
}

export interface CroquisRect {
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

export interface CroquisCutout {
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

export interface CroquisText {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  rotation?: number;
}

export type CroquisElement = CroquisLine | CroquisRect | CroquisCutout | CroquisText;

export interface CroquisPage {
  id: number;
  name: string;
  elements: CroquisElement[];
}

export interface CroquisEditorProps {
  croquis: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}

export type RawElement = Record<string, unknown>;
