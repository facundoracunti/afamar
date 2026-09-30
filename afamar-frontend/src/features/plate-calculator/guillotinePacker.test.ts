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

  it('fragmenta en tramos una pieza que supera el largo (ya no queda sin colocar)', () => {
    // 3.5×1.6 no entra en 3.0×1.8 → se parte en 3.0×1.6 (+ sobrante 0.5×1.6).
    const result = packGuillotine(
      [piece(41, 3.5, 1.6)],
      { plateW: 3, plateH: 1.8, kerf: KERF, allowRotation: true },
    );

    expect(result.unplaced).toHaveLength(0);
    // El sobrante 0.5×1.6 no cabe en la franja del tramo largo → 2ª placa.
    expect(result.platesNeeded).toBe(2);
    const tramos = result.plates.flatMap((pl) => pl.pieces);
    expect(tramos).toHaveLength(2);
    expect(tramos.map((t) => t.split)).toEqual([
      { tramo: 1, total: 2 },
      { tramo: 2, total: 2 },
    ]);
    expect(result.placedM2).toBeCloseTo(3.5 * 1.6);
    expect(verifyNoOverlap(result)).toBe(true);
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

describe('packGuillotine — auto-split de piezas que superan el largo', () => {
  it('fragmenta una mesada de 4.10×0.62 y encaja el tramo corto en la MISMA placa', () => {
    // placa 3.00×1.40 → franja sobrante de 1.40 − 0.62 = 0.78 para el tramo corto.
    const result = packGuillotine(
      [piece(1, 4.1, 0.62)],
      { plateW: 3, plateH: 1.4, kerf: KERF },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(2);
    expect(result.unplaced).toHaveLength(0);

    // El pack ordena por footprint: el tramo largo va primero en la placa.
    const [a, b] = result.plates[0].pieces;
    expect(a.split).toEqual({ tramo: 1, total: 2 });
    expect(b.split).toEqual({ tramo: 2, total: 2 });
    expect(a.origen).toBe(1);
    expect(a.largo).toBeCloseTo(3.0);
    expect(b.largo).toBeCloseTo(1.1);
    expect(a.ancho).toBeCloseTo(0.62);
    expect(b.ancho).toBeCloseTo(0.62);
    // Tramo corto dentro de la franja sobrante, debajo del tramo largo.
    expect(a.x).toBeCloseTo(0);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.h - 1e-9);
    // m² preservado: 3.0×0.62 + 1.1×0.62 = 4.1×0.62.
    expect(a.m2 + b.m2).toBeCloseTo(4.1 * 0.62);
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('fragmenta una pieza de 7.0 m en 3 tramos', () => {
    const result = packGuillotine(
      [piece(7, 7.0, 0.6)],
      { plateW: 3, plateH: 1.8, kerf: KERF },
    );

    expect(result.unplaced).toHaveLength(0);
    const tramos = result.plates.flatMap((pl) => pl.pieces);
    expect(tramos).toHaveLength(3);
    expect(tramos.map((t) => t.split?.tramo)).toEqual([1, 2, 3]);
    expect(tramos.every((t) => t.split?.total === 3)).toBe(true);
    expect(tramos.reduce((s, t) => s + t.m2, 0)).toBeCloseTo(7.0 * 0.6);
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('NO fragmenta una pieza demasiado ancha sin desborde de largo: queda sin colocar', () => {
    // 2.8×2.0 no entra en 3.0×1.8 por el ancho (2.0 > 1.8); el largo no supera la placa.
    const result = packGuillotine(
      [piece(8, 2.8, 2.0)],
      { plateW: 3, plateH: 1.8, kerf: KERF },
    );

    expect(result.platesNeeded).toBe(0);
    expect(totalPlaced(result)).toBe(0);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0]).toMatchObject({ action: 'unplaced', pieceId: 8, origen: 1 });
  });

  it('fragmenta cada copia de una pieza con cantidad > 1', () => {
    const result = packGuillotine(
      [piece(9, 4.1, 0.62, 2)],
      { plateW: 3, plateH: 1.4, kerf: KERF },
    );

    expect(result.unplaced).toHaveLength(0);
    expect(totalPlaced(result)).toBe(4);
    const tramos = result.plates.flatMap((pl) => pl.pieces);
    expect(tramos.filter((t) => t.split?.tramo === 1)).toHaveLength(2);
    expect(tramos.filter((t) => t.split?.tramo === 2)).toHaveLength(2);
    expect(tramos.every((t) => t.split?.total === 2)).toBe(true);
    expect(tramos.reduce((s, t) => s + t.m2, 0)).toBeCloseTo(4.1 * 0.62 * 2);
    expect(verifyNoOverlap(result)).toBe(true);
  });
});

describe('packGuillotine — multi-pasada: compactación de sobrantes y rotación inteligente', () => {
  it('consolida rects libres y compacta la pieza chica en el hueco de la placa anterior', () => {
    // Placa 2×2 sin kerf. El orden por área (1.2×1 primero) abre una 2ª placa;
    // la multi-pasada encuentra el orden [1×1, 1×1, 1.2×1], fusiona las dos
    // bandas inferiores (2×1) y mete la 1.2×1 en la MISMA placa → 1 placa.
    const result = packGuillotine(
      [piece(1, 1.0, 1.0), piece(2, 1.0, 1.0), piece(3, 1.2, 1.0)],
      { plateW: 2, plateH: 2, kerf: 0 },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(3);
    expect(result.unplaced).toHaveLength(0);
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('rota una pieza pequeña para entrar en el hueco de una placa anterior (no abre placa nueva)', () => {
    // Placa 3×2 sin kerf: la 2.9×1 deja una banda inferior de 3×1; la 0.5×2 no
    // cabe acostada pero sí girada (2.0×0.5) en esa franja → 1 sola placa.
    const result = packGuillotine(
      [piece(1, 2.9, 1.0), piece(2, 0.5, 2.0)],
      { plateW: 3, plateH: 2, kerf: 0 },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(2);
    expect(result.unplaced).toHaveLength(0);
    const rotatedPiece = result.plates[0].pieces.find((p) => p.pieceId === 2);
    expect(rotatedPiece).toBeDefined();
    expect(rotatedPiece?.rotated).toBe(true);
    expect(verifyNoOverlap(result)).toBe(true);
  });
});

describe('packGuillotine — bordes de fábrica: dimensión == placa (sin kerf en el borde exterior)', () => {
  it('una pieza de 3.00×0.90 entra de punta a punta en una placa de 3.00×1.40 (ya no la rebota)', () => {
    // Regresión reportada: el packer sumaba el kerf a los 3.00m (3.006 > 3.00)
    // y rechazaba la pieza. En el taller el 3.00 usa los bordes de fábrica de
    // la placa: NO se corta a lo largo, solo a lo ancho para los 0.90m.
    const result = packGuillotine(
      [piece(1, 3.0, 0.9)],
      { plateW: 3, plateH: 1.4, kerf: KERF },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(1);
    expect(result.unplaced).toHaveLength(0);
    const placed = result.plates[0].pieces[0];
    expect(placed.split).toBeUndefined();
    expect(placed.rotated).toBe(false);
    // Footprint FLUSH en el eje del largo (sin kerf: usa el borde de fábrica);
    // el ancho conserva el kerf*2 porque sí se corta.
    expect(placed.w).toBe(3.0);
    expect(placed.h).toBeCloseTo(0.9 + KERF * 2);
    expect(placed.x).toBe(0);
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('una pieza de ancho igual a la placa también usa el borde de fábrica en ese eje', () => {
    const result = packGuillotine(
      [piece(2, 2.0, 1.4)],
      { plateW: 3, plateH: 1.4, kerf: KERF },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(1);
    expect(result.unplaced).toHaveLength(0);
    const placed = result.plates[0].pieces[0];
    expect(placed.w).toBeCloseTo(2.0 + KERF * 2); // el largo sí se corta
    expect(placed.h).toBe(1.4); // ancho flush → borde de fábrica
    expect(verifyNoOverlap(result)).toBe(true);
  });

  it('una pieza que calza exacta a la placa completa (3.00×1.40) entra sin fragmentarse', () => {
    const result = packGuillotine(
      [piece(3, 3.0, 1.4)],
      { plateW: 3, plateH: 1.4, kerf: KERF },
    );

    expect(result.platesNeeded).toBe(1);
    expect(totalPlaced(result)).toBe(1);
    expect(result.unplaced).toHaveLength(0);
    expect(result.plates[0].pieces[0]).toMatchObject({
      w: 3.0,
      h: 1.4,
      rotated: false,
    });
    expect(verifyNoOverlap(result)).toBe(true);
  });
});