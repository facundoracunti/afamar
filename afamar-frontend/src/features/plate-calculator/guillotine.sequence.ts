import { mergeFreeRects } from './guillotine.merge';
import { bestFit, betterNewPlateOrientation, splitFreeRect } from './guillotine.placement';
import type {
  GuillotineResult,
  Item,
  PackAction,
  PackOptions,
  PlateBuild,
  PlateLayout,
  PlacedPiece,
} from './guillotine.types';

/**
 * Runs ONE full guillotine sequence over a pre-sorted item list: fits each
 * item into the best existing free rectangle (both orientations, any plate),
 * merging the plate's free rectangles after every placement; opens a new plate
 * only when NOTHING fits in the existing ones.
 */
export function packSequence(
  sorted: Item[],
  options: PackOptions,
  plateM2: number,
): GuillotineResult {
  const { plateW, plateH, kerf, allowRotation = true } = options;
  const platesBuild: PlateBuild[] = [];
  const placed: PlacedPiece[] = [];
  const unplaced: PackAction[] = [];

  for (const item of sorted) {
    // Does the footprint fit inside the plate in either orientation?
    const fitsNormal = item.fw <= plateW && item.fh <= plateH;
    const fitsRotated = allowRotation && item.fh <= plateW && item.fw <= plateH;

    if (!fitsNormal && !fitsRotated) {
      unplaced.push({
        action: 'unplaced',
        pieceId: item.pieceId,
        pieceIndex: item.pieceIndex,
        origen: item.origen,
        nombre: item.nombre,
        largo: item.largo,
        ancho: item.ancho,
        split: item.split,
      });
      continue;
    }

    // bestFit already tries every free rect of every EXISTING plate in both
    // orientations — a small piece rotated into a previous plate's leftover is
    // the natural outcome before any new plate is considered.
    let fit = bestFit(item.fw, item.fh, allowRotation, platesBuild);

    if (!fit) {
      // Open a new plate and place into its single (full) free rect, picking
      // the orientation that fits best on a fresh plate: the forced one when
      // only one orientation fits, otherwise whichever leaves the larger
      // minimal leftover band (betterNewPlateOrientation).
      const plate: PlateBuild = {
        pieces: [],
        freeRects: [{ x: 0, y: 0, w: plateW, h: plateH }],
      };
      platesBuild.push(plate);
      const useRotated =
        !fitsNormal ||
        (fitsRotated && betterNewPlateOrientation(item.fw, item.fh, plateW, plateH));
      fit = {
        plateIndex: platesBuild.length - 1,
        rectIndex: 0,
        w: useRotated ? item.fh : item.fw,
        h: useRotated ? item.fw : item.fh,
        rotated: useRotated,
      };
    }

    const plate = platesBuild[fit.plateIndex];
    const rect = plate.freeRects[fit.rectIndex];
    plate.freeRects.splice(fit.rectIndex, 1);
    plate.freeRects.push(...splitFreeRect(rect, fit.w, fit.h));
    // Consolidate adjacent free bands AFTER every placement so a small piece
    // may use the merged region instead of forcing a new (nearly empty) plate.
    plate.freeRects = mergeFreeRects(plate.freeRects);

    const piece: PlacedPiece = {
      pieceId: item.pieceId,
      pieceIndex: item.pieceIndex,
      origen: item.origen,
      nombre: item.nombre,
      x: rect.x,
      y: rect.y,
      w: fit.w,
      h: fit.h,
      largo: item.largo,
      ancho: item.ancho,
      rotated: fit.rotated,
      m2: item.area,
      split: item.split,
    };
    plate.pieces.push(piece);
    placed.push(piece);
  }

  const plates: PlateLayout[] = platesBuild.map((pb, i) => ({
    index: i,
    plateM2,
    usedM2: pb.pieces.reduce((sum, p) => sum + p.m2, 0),
    pieces: pb.pieces,
  }));

  const piecesM2 = sorted.reduce((s, i) => s + i.area, 0);
  const placedM2 = placed.reduce((s, p) => s + p.m2, 0);
  const platesNeeded = plates.length;
  const platesM2Bought = platesNeeded * plateM2;
  const utilizationPct =
    platesM2Bought > 0 ? (placedM2 / platesM2Bought) * 100 : 0;

  return {
    plates,
    platesNeeded,
    piecesM2,
    placedM2,
    platesM2Bought,
    utilizationPct,
    wastePct: Math.max(0, 100 - utilizationPct),
    unplaced,
    plateW,
    plateH,
    kerf,
    usedM2: placedM2,
  };
}
