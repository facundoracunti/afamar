import { EPS } from './guillotine.constants';
import type { Item, PackOptions, PackPieceInput } from './guillotine.types';

/**
 * Rounds to mm precision (3 decimals) — enough for the split arithmetic to
 * avoid float residue (e.g. 4.1 - 3.0 = 1.0999999999999996 → 1.1).
 */
function roundM(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Footprint of a piece along ONE axis given its nominal dimension and the full
 * plate dimension on that axis. When the measured dimension equals the plate's
 * (within EPS, i.e. the piece runs edge-to-edge using the factory edges),
 * NO kerf is added on that axis: the factory edge needs no cut, so a 3.00m
 * piece in a 3.00m plate fits flush. Otherwise the blade margin applies on
 * both sides as usual (dim + kerf*2).
 */
function factoryFootprint(dim: number, plateDim: number, kerf: number): number {
  return Math.abs(dim - plateDim) < EPS ? dim : dim + kerf * 2;
}

/**
 * Splits a length along the largo axis into tramos of at most `max` meters.
 * The first tramos are `max` (the full plate length) and the leftover goes
 * last (e.g. 4.1 in a 3.0 plate → [3.0, 1.1]). Trailing float residue smaller
 * than 1e-6 is ignored (it rounded to a zero-length tramo).
 */
function splitAlongLength(total: number, max: number): number[] {
  const out: number[] = [];
  let remaining = total;
  while (remaining > 1e-6) {
    const t = Math.min(max, remaining);
    out.push(roundM(t));
    remaining -= t;
  }
  return out;
}

/**
 * Expands the input pieces into individual items (one per copy × per auto-split
 * tramo), computing the footprint, fits and the split metadata per item. Items
 * whose footprint cannot fit the plate in either orientation (too wide, without
 * an oversized length to split) are still added so the sequence reports them as
 * `unplaced`.
 */
export function buildItems(pieces: PackPieceInput[], options: PackOptions): Item[] {
  const { plateW, plateH, kerf } = options;
  const allowRotation = options.allowRotation ?? true;

  const items: Item[] = [];
  for (let oi = 0; oi < pieces.length; oi++) {
    const p = pieces[oi];
    const cantidad = Math.max(1, Math.floor(p.cantidad) || 1);
    // Factory-edge rule: a dimension equal to the full plate axis spans the
    // factory edges → no kerf on that axis (e.g. 3.00m in a 3.00m plate fits
    // flush instead of needing 3.005m).
    const fw = factoryFootprint(p.largo, plateW, kerf);
    const fh = factoryFootprint(p.ancho, plateH, kerf);
    const fitsNormal = fw <= plateW && fh <= plateH;
    const fitsRotated = allowRotation && fh <= plateW && fw <= plateH;
    // Auto-split: a piece neither fits normally nor rotated AND its nominal
    // largo exceeds the plate length → break it along the largo into tramos
    // ([plateW, plateW, ..., leftover]), each packed independently. Too-wide
    // pieces (ancho overflow, no largo overflow) keep the "unplaced" meaning.
    const tramos =
      !fitsNormal && !fitsRotated && p.largo > plateW
        ? splitAlongLength(p.largo, plateW)
        : null;
    for (let i = 0; i < cantidad; i++) {
      if (tramos) {
        const total = tramos.length;
        for (let t = 0; t < total; t++) {
          const tramoLargo = tramos[t];
          items.push({
            pieceId: p.id,
            pieceIndex: i,
            origen: oi + 1,
            nombre: p.nombre,
            largo: tramoLargo,
            ancho: p.ancho,
            // A tramo flush with the full plate length uses the factory edge
            // (no kerf consumed along that side), so it fits exactly `plateW`.
            fw: Math.min(tramoLargo + kerf * 2, plateW),
            fh,
            area: tramoLargo * p.ancho,
            split: { tramo: t + 1, total },
          });
        }
      } else {
        items.push({
          pieceId: p.id,
          pieceIndex: i,
          origen: oi + 1,
          nombre: p.nombre,
          largo: p.largo,
          ancho: p.ancho,
          fw,
          fh,
          area: p.largo * p.ancho,
        });
      }
    }
  }
  return items;
}
