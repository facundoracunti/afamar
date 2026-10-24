/**
 * PDF data types — MATERIAL / PILETA / FABRICACIÓN / ADICIONAL domain.
 *
 * Extracted from `pdfTypes.ts` (which stays the public barrel). These are the
 * row shapes the builders produce and the renderer draws: one material row,
 * one pool (pileta) row, one generic fabrication row and one additional-work
 * row.
 */

export interface PdfDataRow {
  readonly concept: string;
  readonly detail: string;
  readonly material: string;
  readonly show_length: boolean;
  readonly show_width: boolean;
  readonly show_m2: boolean;
  readonly show_quantity: boolean;
  readonly length_str: string | null;
  readonly width_str: string | null;
  readonly m2_label: string | null;
  readonly quantity: number;
  readonly currency: 'ARS' | 'USD';
  readonly price_str: string;
  /** Unit price per m² for m² concepts (ZÓCALO / FRENTE / BASEBOARD /
   *  FRONT). The stored `price` for an m² row is the row's total
   *  (m² × $/m²), so the renderer shows this unit value in the Precio
   *  column instead of duplicating the Subtotal (`Subtotal = M² × Precio/m²`).
   *  `null` for non-m² concepts. */
  readonly price_per_m2_str: string | null;
  readonly labor_str: string | null;
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
  /** Numeric m² (length × width × quantity) for m² concepts. Populated so
   *  the per-option section builder can revalue a "global" (unassigned)
   *  m² fabrication row — e.g. a ZÓCALO — against each alternative's own
   *  material price. `null` for non-m² concepts. */
  readonly m2: number | null;
}

export interface MaterialPdfRow {
  readonly name: string;
  readonly color: string;
  readonly length_str: string;
  readonly width_str: string;
  readonly quantity: number;
  readonly m2_str: string;
  readonly price_m2_str: string;
  readonly subtotal_str: string;
  readonly currency: 'ARS' | 'USD';
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
}

export interface PoolPdfRow {
  readonly brand: string;
  readonly model: string;
  readonly quantity: number;
  readonly price_str: string;
  readonly subtotal_str: string;
  readonly currency: 'ARS' | 'USD';
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
  readonly material: string;
}

export interface AdditionalWorkPdfRow {
  readonly name: string;
  readonly detail: string | null;
  readonly currency: 'ARS' | 'USD';
  readonly price_str: string;
  readonly quantity: number;
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
  readonly type?: 'flat' | 'frente';
  readonly linear_meters_str?: string | null;
  readonly material_price_per_m2_str?: string | null;
  readonly formula_constant_str?: string | null;
  readonly material_name?: string;
  /** Numeric linear metres for a `frente` row (0/absent otherwise), so the
   *  section builder can revalue a global frente against each alternative's
   *  material price per m². */
  readonly linear_meters?: number;
  /** Formula multiplier kept on the `frente` row (defaults to 1.15). Used
   *  with `linear_meters` to revalue a global frente per option. */
  readonly multiplier?: number;
  /** Catalogue id of the material the row is linked to (`null`/absent means
   *  the row is GLOBAL — "suma al total" — even if a legacy `material_name`
   *  still carries a name). Used so the bucketing treats an unassigned
   *  frente as a common row shown in every option. */
  readonly assigned_material_id?: number | string | null;
}
