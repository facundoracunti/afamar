import { useMemo } from 'react';

export interface Pieza {
  id: number;
  largo: number;
  ancho: number;
  cantidad: number;
}

export interface PlateCalculatorResult {
  placasNecesarias: number;
  utilizacion: number;
  desperdicio: number;
  totalM2: number;
  totalM2Bruto: number;
  barModifier: 'high' | 'mid' | 'low';
}

const ANCHO_DISCO = 0.003;

export function usePlateCalculator(
  piezas: Pieza[],
  plateW: number,
  plateH: number,
): PlateCalculatorResult {
  return useMemo(() => {
    const totalM2 = piezas.reduce((sum, p) => sum + p.largo * p.ancho * p.cantidad, 0);
    const totalM2Bruto = piezas.reduce(
      (sum, p) => sum + (p.largo + ANCHO_DISCO) * (p.ancho + ANCHO_DISCO) * p.cantidad,
      0,
    );

    const items: { w: number; h: number }[] = [];
    piezas.forEach((p: Pieza) => {
      for (let i = 0; i < (p.cantidad || 1); i++) {
        items.push({ w: p.largo + ANCHO_DISCO * 2, h: p.ancho + ANCHO_DISCO * 2 });
      }
    });

    let placasNecesarias = 0;
    let utilizacion = 0;
    let desperdicio = 0;

    if (items.length > 0) {
      items.sort((a, b) => (b.w * b.h) - (a.w * a.h));
      const bins: { x: number; y: number; w: number; h: number }[][] = [];

      for (const piece of items) {
        let placed = false;
        for (let bi = 0; bi < bins.length && !placed; bi++) {
          const freeRects = bins[bi];
          let bestIdx = -1;
          let bestWaste = Infinity;
          let bestOrient: { w: number; h: number } | null = null;

          for (let ri = 0; ri < freeRects.length; ri++) {
            const r = freeRects[ri];
            for (const o of [{ w: piece.w, h: piece.h }, { w: piece.h, h: piece.w }]) {
              if (o.w <= r.w && o.h <= r.h && (r.w - o.w) * (r.h - o.h) < bestWaste) {
                bestWaste = (r.w - o.w) * (r.h - o.h);
                bestIdx = ri;
                bestOrient = o;
              }
            }
          }

          if (bestIdx >= 0) {
            const r = freeRects[bestIdx];
            freeRects.splice(bestIdx, 1);
            if (r.w - bestOrient!.w > 0)
              freeRects.push({ x: r.x + bestOrient!.w, y: r.y, w: r.w - bestOrient!.w, h: bestOrient!.h });
            if (r.h - bestOrient!.h > 0)
              freeRects.push({ x: r.x, y: r.y + bestOrient!.h, w: r.w, h: r.h - bestOrient!.h });
            placed = true;
          }
        }

        if (!placed) {
          bins.push([{ x: 0, y: 0, w: plateW, h: plateH }]);
          const freeRects = bins[bins.length - 1];
          const r = freeRects[0];
          const o =
            piece.w <= r.w && piece.h <= r.h
              ? { w: piece.w, h: piece.h }
              : { w: piece.h, h: piece.w };
          freeRects.splice(0, 1);
          if (r.w - o.w > 0) freeRects.push({ x: o.w, y: 0, w: r.w - o.w, h: o.h });
          if (r.h - o.h > 0) freeRects.push({ x: 0, y: o.h, w: r.w, h: r.h - o.h });
        }
      }

      placasNecesarias = bins.length;
      const totalArea = items.reduce((s, p) => s + p.w * p.h, 0);
      utilizacion = (totalArea / (placasNecesarias * plateW * plateH)) * 100;
      desperdicio = 100 - utilizacion;
    }

    const barModifier: 'high' | 'mid' | 'low' =
      utilizacion >= 80 ? 'high' : utilizacion >= 60 ? 'mid' : 'low';

    return { placasNecesarias, utilizacion, desperdicio, totalM2, totalM2Bruto, barModifier };
  }, [piezas, plateW, plateH]);
}
