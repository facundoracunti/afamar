import { describe, it, expect } from 'vitest';
import {
  packGuillotine,
  verifyNoOverlap,
  type PackPieceInput,
  type GuillotineResult,
} from './guillotinePacker';

const KERF = 0.003; // 3 mm

function piece(id: number, largo: number, ancho: number, cantidad = 1): PackPieceInput {
  return { id, largo, ancho, cantidad };
}

function totalPlaced(result: GuillotineResult): number {
  return result.plates.reduce((sum, plate) => sum + plate.pieces.length, 0);
}

describe('packGuillotine — cálculos simples', () => {
  it('coloca una única pieza en una placa, sin sobrescribir medidas nominales', () => {
    const result = packGuillotine(
      [piece(1, 1.2, 0.6)],
      { plateW: 3, plateH: 1.8, kerf: KERF },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(1);
    expect(result.plates[0].pieces[0]).toMatchObject({
      pieceId: 1,
      x: 0,
      y: 0,
      w: 1.2 + KERF * 2,
      h: 0.6 + KERF * 2,
      rotated: false,
    });
    expect(result.plates[0].pieces[0].m2).toBeCloseTo(0.72);
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('repite la pieza según cantidad y respeta el kerf de cada copia', () => {
    const result = packGuillotine(
      [piece(7, 1.0, 0.5, 3)],
      { plateW: 2, plateH: 2, kerf: KERF },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(3);
    for (const plate of result.plates) {
      for (const p of plate.pieces) {
        expect(p.w).toBeCloseTo(1.0 + KERF * 2);
        expect(p.h).toBeCloseTo(0.5 + KERF * 2);
        expect(p.pieceId).toBe(7);
      }
    }
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('rotación 90° cuando la pieza solo entra girada', () => {
    // 0.5 × 1.9 no entra acostada (1.9 > 1.8) pero sí girada
    const result = packGuillotine(
      [piece(3, 0.5, 1.9)],
      { plateW: 3, plateH: 1.8, kerf: KERF, allowRotation: true },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(1);
    expect(result.plates[0].pieces[0].rotated).toBe(true);
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('pieza que no entra ni girada queda sin colocar', () => {
    const result = packGuillotine(
      [piece(4, 3.5, 1.6)],
      { plateW: 3, plateH: 1.8, kerf: KERF, allowRotation: true },
    );

    expect(result.platesNeeded).toBe(0);
    expect(totalPlaced(result)).toBe(0);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0]).toMatchObject({ action: 'unplaced', pieceId: 4 });
  });
});

describe('packGuillotine — distribución en 1+ placas sin solapamiento', () => {
  it('coloca un set complejo en varias placas sin solaparse y dentro de los límites', () => {
    const pieces: PackPieceInput[] = [
      piece(1, 2.1, 0.6),
      piece(2, 1.8, 0.55, 2),
      piece(3, 1.2, 0.6, 3),
      piece(4, 0.6, 0.6, 4),
      piece(5, 2.5, 0.75),
      piece(6, 1.1, 0.35, 2),
    ];
    const result = packGuillotine(pieces, { plateW: 3, plateH: 1.8, kerf: KERF });

    expect(result.platesNeeded).toBeGreaterThanOrEqual(2);
    expect(totalPlaced(result)).toBe(1 + 2 + 3 + 4 + 1 + 2);
    expect(result.unplaced).toHaveLength(0);
    expect(verifyNoOverlap(result)).toBe(true);

    const placedM2 = result.plates.reduce((s, p) => s + p.usedM2, 0);
    expect(placedM2).toBeCloseTo(result.placedM2);
    expect(result.utilizationPct).toBeGreaterThan(0);
    expect(result.utilizationPct + result.wastePct).toBeCloseTo(100, 1);
  });

  it('reactivo: con rotación deshabilitada el pack es válido y sin solapes', () => {
    const pieces: PackPieceInput[] = [
      piece(1, 2.8, 1.0),
      piece(2, 2.8, 0.5),
      piece(3, 1.4, 0.9),
      piece(4, 1.4, 0.9),
    ];
    const result = packGuillotine(pieces, {
      plateW: 3,
      plateH: 1.8,
      kerf: KERF,
      allowRotation: false,
    });

    expect(result.unplaced).toHaveLength(0);
    for (const plate of result.plates) {
      for (const p of plate.pieces) {
        expect(p.rotated).toBe(false);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(result.plateW + 1e-9);
        expect(p.y + p.h).toBeLessThanOrEqual(result.plateH + 1e-9);
      }
    }
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('al deshabilitar la rotación puede necesitar más placas o dejar piezas fuera', () => {
    const pieces: PackPieceInput[] = [
      piece(1, 2.9, 1.7),
      piece(2, 2.9, 1.7),
      piece(3, 2.9, 1.7),
    ];
    // Con rotación: las tres entran acostadas/giradas (3.0 × 1.8 aprox).
    // El propósito acá es confirmar que la bandera cambia el resultado sin
    // romper la invariante de no-solape.
    const withRotation = packGuillotine(pieces, {
      plateW: 3,
      plateH: 1.8,
      kerf: KERF,
      allowRotation: true,
    });
    const withoutRotation = packGuillotine(pieces, {
      plateW: 3,
      plateH: 1.8,
      kerf: KERF,
      allowRotation: false,
    });

    expect(verifyNoOverlap(withRotation)).toBe(true);
    expect(verifyNoOverlap(withoutRotation)).toBe(true);
    expect(withoutRotation.platesNeeded).toBeGreaterThanOrEqual(withRotation.platesNeeded);
  });

  it('set vacío → cero placas y 0% de aprovechamiento', () => {
    const result = packGuillotine([], { plateW: 3, plateH: 1.8, kerf: KERF });
    expect(result.platesNeeded).toBe(0);
    expect(result.utilizationPct).toBe(0);
    expect(result.unplaced).toHaveLength(0);
  });
});