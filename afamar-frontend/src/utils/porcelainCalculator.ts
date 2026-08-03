import type { FabricationDetail } from '../types/budget';
import { round2 } from './math';

export const PORCELAIN_CUT_SERVICE = 'Corte de zócalos de porcelanato';

export interface PorcelainCutInput {
  /** Largo de la placa de porcelanato, en metros. */
  largoM: number;
  /** Ancho de la placa de porcelanato, en metros. */
  anchoM: number;
  /** Cantidad de cajas. */
  cajas: number;
  /** Piezas por caja. */
  piezasPorCaja: number;
  /** Altura del zócalo solicitada, en metros. */
  alturaM: number;
  /** Espesor del disco de corte, en milímetros (default 3). */
  discoMm: number;
  /** Precio por metro lineal (en la moneda del form). */
  precioPorMl: number;
}

export interface PorcelainCutResult {
  /** Placas totales = cajas × piezas por caja. */
  placas: number;
  /** Cortes (tiras de zócalo) por placa, considerando la pérdida del disco. */
  cortesPorPlaca: number;
  /** Cortes totales = placas × cortes por placa. */
  cortesTotal: number;
  /** Metros lineales de zócalo producidos. */
  ml: number;
  /** Importe total = ML × precio por ML. */
  total: number;
  /** Altura final aproximada = altura solicitada − espesor del disco. Solo informativo. */
  alturaFinalM: number;
}

/**
 * Calcula la producción de zócalos a partir de placas de porcelanato.
 *
 * La cantidad de tiras por placa considera la pérdida por el espesor del disco:
 * la secuencia en el ancho de la placa es `zócalo + disco + zócalo + disco …`,
 * así que el ancho ocupado por n tiras es `n × altura + (n − 1) × disco`.
 *
 * El máximo n que cabe se obtiene de `floor((anchoMm + discoMm) / (alturaMm + discoMm))`
 * (ej.: placa 600 mm, zócalo 100 mm, disco 3 mm → floor(603/103) = 5, no 600÷100 = 6).
 */
export function calculatePorcelainCut(input: PorcelainCutInput): PorcelainCutResult {
  const { largoM, anchoM, cajas, piezasPorCaja, alturaM, discoMm, precioPorMl } = input;
  const placas = Math.max(0, Math.floor(cajas)) * Math.max(0, Math.floor(piezasPorCaja));
  const anchoMm = anchoM * 1000;
  const alturaMm = alturaM * 1000;
  const cortesPorPlaca =
    anchoMm >= alturaMm ? Math.floor((anchoMm + discoMm) / (alturaMm + discoMm)) : 0;
  const cortesTotal = placas * cortesPorPlaca;
  const ml = round2(cortesTotal * largoM);
  const total = round2(ml * precioPorMl);
  const alturaFinalM = alturaM - discoMm / 1000;
  return { placas, cortesPorPlaca, cortesTotal, ml, total, alturaFinalM };
}

/** Formatea las medidas de la placa en cm para la descripción (ej.: "120x60"). */
export function formatPorcelainPlateCm(largoM: number, anchoM: number): string {
  const largoCm = Math.round(largoM * 100);
  const anchoCm = Math.round(anchoM * 100);
  return `${largoCm}x${anchoCm}`;
}

/**
 * Construye el ítem de fabricación que se agrega al presupuesto / orden:
 * concepto `OTHER` + `custom_concept` (el PDF muestra el texto custom).
 */
export function buildPorcelainFabricationDetail(
  input: PorcelainCutInput,
  currency: 'ARS' | 'USD',
): FabricationDetail {
  const r = calculatePorcelainCut(input);
  const plateCm = formatPorcelainPlateCm(input.largoM, input.anchoM);
  const alturaCm = Math.round(input.alturaM * 100);
  const mlStr = r.ml.toFixed(2);
  const detail = `${plateCm} · ${r.placas} placas · Altura solicitada ${alturaCm} cm · Producción ${mlStr} ML`;
  return {
    concept: 'OTHER',
    custom_concept: PORCELAIN_CUT_SERVICE,
    detail,
    length: r.ml,
    labor: input.precioPorMl,
    width: null,
    m2: 0,
    material: '',
    material_price_m2: 0,
    currency,
    quantity: 1,
    price: r.total,
  };
}
