/**
 * PDF data types — COMPARATIVA DE MEDICIÓN domain.
 *
 * Extracted from `pdfTypes.ts` (which stays the public barrel). One row of
 * the "COMPARATIVA DE MEDICIÓN" table (work orders only).
 */

/** One row of the "COMPARATIVA DE MEDICIÓN" table (work orders only). */
export interface MeasurementComparisonRow {
  readonly concepto: string;
  readonly m2_budgeted: number | null;
  readonly m2_real: number;
  readonly delta: number | null;
  readonly m2_budgeted_str: string;
  readonly m2_real_str: string;
  readonly delta_str: string;
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
  readonly subtotal_ars_str: string;
  readonly subtotal_usd_str: string;
  /** Detail rows (zócalo/frente) are indented under their material and carry
   *  a monetary subtotal PLUS their unit-aware measure columns (m² for
   *  zócalos, ml for frentes). Flat works / legacy rows without a dimensional
   *  snapshot leave the measure columns blank (`measure_unit: null`). */
  readonly is_detail?: boolean;
  readonly measure_budgeted: number | null;
  readonly measure_real: number | null;
  readonly measure_delta: number | null;
  readonly measure_unit: 'm2' | 'ml' | null;
  readonly measure_budgeted_str: string;
  readonly measure_real_str: string;
  readonly measure_delta_str: string;
  /** Section/group this row belongs to (the operator-facing piece name, e.g.
   *  "COCINA" or "PARRILLA"). When the comparativa renders, every row with
   *  the same `piece_name` is grouped under one header. */
  readonly piece_name?: string;
  /** Marker row that prints the piece name as a bold section title spanning
   *  the whole table — emitted once per piece before its material/fabrication/
   *  additional rows. The renderer should NOT draw numeric cells on these. */
  readonly is_section_header?: boolean;
}
