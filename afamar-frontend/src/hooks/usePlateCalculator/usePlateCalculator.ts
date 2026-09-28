import { useMemo } from 'react';
import {
  packGuillotine,
  type PackPieceInput,
  type PlacedPiece,
  type PlateLayout,
  type PackAction,
} from '../../features/plate-calculator/guillotinePacker';

export interface Pieza {
  id: number;
  nombre?: string;
  largo: number;
  ancho: number;
  cantidad: number;
}

export interface PlateCalculatorOptions {
  /** Blade width in meters (default 0.003 = 3 mm). Applied per side per piece. */
  kerf?: number;
  /** Allow 90° rotation of pieces (default true). */
  allowRotation?: boolean;
}

export interface PlateCalculatorResult {
  placasNecesarias: number;
  utilizacion: number;
  desperdicio: number;
  totalM2: number;
  totalM2Bruto: number;
  barModifier: 'high' | 'mid' | 'low';

  // Guillotine layout (new)
  plates: PlateLayout[];
  pieces: PlacedPiece[];
  unplaced: PackAction[];
  plateM2: number;
  plateW: number;
  plateH: number;
  platesM2Bought: number;
  kerf: number;
  allowRotation: boolean;
}

const ANCHO_DISCO = 0.003;

export function usePlateCalculator(
  piezas: Pieza[],
  plateW: number,
  plateH: number,
  options?: PlateCalculatorOptions,
): PlateCalculatorResult {
  const kerf = options?.kerf ?? ANCHO_DISCO;
  const allowRotation = options?.allowRotation ?? true;

  return useMemo(() => {
    const packInput: PackPieceInput[] = piezas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      largo: p.largo,
      ancho: p.ancho,
      cantidad: p.cantidad,
    }));

    const layout = packGuillotine(packInput, { plateW, plateH, kerf, allowRotation });

    const totalM2 = piezas.reduce((sum, p) => sum + p.largo * p.ancho * p.cantidad, 0);
    const totalM2Bruto = piezas.reduce(
      (sum, p) => sum + (p.largo + kerf) * (p.ancho + kerf) * p.cantidad,
      0,
    );

    const utilizacion = layout.utilizationPct;

    const barModifier: 'high' | 'mid' | 'low' =
      utilizacion >= 80 ? 'high' : utilizacion >= 60 ? 'mid' : 'low';

    const pieces = layout.plates.flatMap((pl) => pl.pieces);

    return {
      placasNecesarias: layout.platesNeeded,
      utilizacion,
      desperdicio: layout.wastePct,
      totalM2,
      totalM2Bruto,
      barModifier,
      plates: layout.plates,
      pieces,
      unplaced: layout.unplaced,
      plateM2: layout.plates.length > 0 ? layout.plates[0].plateM2 : plateW * plateH,
      plateW,
      plateH,
      platesM2Bought: layout.platesM2Bought,
      kerf,
      allowRotation,
    };
  }, [piezas, plateW, plateH, kerf, allowRotation]);
}