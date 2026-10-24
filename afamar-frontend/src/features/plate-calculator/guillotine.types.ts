/**
 * Types of the guillotine bin-packing engine.
 *
 * The PUBLIC types (PackPieceInput … GuillotineResult) are re-exported from
 * `guillotinePacker.ts` so every consumer keeps importing from the same path.
 * The INTERNAL types (FreeRect / Item / Fit / PlateBuild) describe the
 * working state of the packer and never leave the engine.
 */

export interface PackPieceInput {
  id: number;
  nombre?: string;
  largo: number;
  ancho: number;
  cantidad: number;
}

export interface PackOptions {
  plateW: number;
  plateH: number;
  kerf: number;
  allowRotation?: boolean;
}

export interface SplitTramoInfo {
  /** 1-based index of this tramo within the original oversized piece. */
  tramo: number;
  /** Total number of tramos the original piece was split into. */
  total: number;
}

export interface PlacedPiece {
  pieceId: number;
  pieceIndex: number; // which copy (0..cantidad-1) of this piece
  origen?: number; // 1-based index of the original input piece (matches the "#" column)
  nombre?: string;
  x: number;
  y: number;
  w: number; // footprint width  (largo + kerf*2 when not rotated, etc.)
  h: number; // footprint height
  largo: number; // nominal largo
  ancho: number; // nominal ancho
  rotated: boolean;
  m2: number; // nominal area of the piece
  split?: SplitTramoInfo; // present when the piece was auto-split (oversized length)
}

export interface PlateLayout {
  index: number; // 0-based
  plateM2: number;
  usedM2: number; // sum of nominal piece m2 placed on this plate
  pieces: PlacedPiece[];
}

export interface PackAction {
  action: 'placed' | 'unplaced';
  pieceId: number;
  pieceIndex: number;
  origen?: number; // 1-based index of the original input piece
  nombre?: string;
  largo: number;
  ancho: number;
  split?: SplitTramoInfo; // present when this is a tramo of an auto-split piece
}

export interface GuillotineResult {
  plates: PlateLayout[];
  platesNeeded: number;
  piecesM2: number; // nominal m2 of all pieces (placed + unplaced)
  placedM2: number; // nominal m2 of placed pieces
  platesM2Bought: number; // platesNeeded * plateW * plateH
  utilizationPct: number; // placedM2 / platesM2Bought * 100
  wastePct: number; // 100 - utilizationPct
  unplaced: PackAction[];
  plateW: number;
  plateH: number;
  kerf: number;
  usedM2: number; // alias of placedM2 for convenience
}

/**
 * Ordering strategies tried by the multi-pass packer. Each sorts the SAME item
 * list and runs a full sequence; ties between layouts are broken by the order
 * of HEURISTIC_ORDER (a heuristic that appears earlier wins).
 */
export type PackHeuristic =
  | 'area' // footprint area desc
  | 'longerSide' // longest side of the footprint desc
  | 'perimeter' // footprint perimeter desc
  | 'width' // footprint width desc
  | 'height' // footprint height desc
  | 'shortSide'; // shortest side of the footprint desc

/** Free rectangle still available inside a plate. */
export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One packable unit: a piece copy (or a tramo of an auto-split piece). */
export interface Item {
  pieceId: number;
  pieceIndex: number;
  origen: number; // 1-based index of the original input piece
  nombre?: string;
  largo: number;
  ancho: number;
  fw: number; // footprint width
  fh: number; // footprint height
  area: number; // nominal area
  split?: SplitTramoInfo;
}

/** Placement decision: which free rect of which plate takes the footprint. */
export interface Fit {
  plateIndex: number;
  rectIndex: number;
  w: number;
  h: number;
  rotated: boolean;
}

/** Working state of a plate while the sequence is being built. */
export interface PlateBuild {
  pieces: PlacedPiece[];
  freeRects: FreeRect[];
}
