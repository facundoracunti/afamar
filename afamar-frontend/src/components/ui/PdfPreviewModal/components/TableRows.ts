import type {
  AdditionalWorkPdfRow,
  MaterialPdfRow,
  MeasurementComparisonRow,
  PdfDataRow,
  PoolPdfRow,
} from '../../../../utils/pdf/buildPdfData';
import { fmt } from '../DocumentPdf.utils';

// Table column headers + flex ratios shared by the main tables (fabrication,
// materials, pools, additional works, measurement comparison) across every
// render mode (option sections, pieces, alternatives sheet, legacy flat).

export const FAB_HEADERS = [
  { label: 'Concepto' },
  { label: 'Detalle' },
  { label: 'Material' },
  { label: 'Largo', num: true },
  { label: 'Ancho', num: true },
  { label: 'M²/Cant', num: true },
  { label: 'Precio', num: true },
  { label: 'Mano de obra', num: true },
  { label: 'Mon.' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
export const FAB_FLEXES = [2, 2.8, 1.6, 0.6, 0.6, 0.5, 0.9, 0.9, 0.5, 1.1, 1.1];

export const MAT_HEADERS = [
  { label: 'Material' },
  { label: 'Color' },
  { label: 'Largo', num: true },
  { label: 'Ancho', num: true },
  { label: 'Cant.', num: true },
  { label: 'M²', num: true },
  { label: 'Precio/m²', num: true },
  { label: 'Mon.' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
export const MAT_FLEXES = [2.4, 1.4, 0.6, 0.6, 0.4, 0.8, 1, 0.5, 1.2, 1.2];

export const POOL_HEADERS = [
  { label: 'Marca' },
  { label: 'Modelo' },
  { label: 'Cant.', num: true },
  { label: 'Precio', num: true },
  { label: 'Mon.' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
export const POOL_FLEXES = [2, 2, 0.4, 1, 0.5, 1.2, 1.2];

export const ADDITIONAL_WORKS_HEADERS = [
  { label: 'Adicional' },
  { label: 'Detalle' },
  { label: 'Cant.', num: true },
  { label: 'Precio', num: true },
  { label: 'Mon.' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
export const ADDITIONAL_WORKS_FLEXES = [2, 2.4, 0.4, 1, 0.5, 1.2, 1.2];

export const COMPARISON_HEADERS = [
  { label: 'Concepto' },
  { label: 'Presupuestado', num: true },
  { label: 'Real', num: true },
  { label: 'Diferencia', num: true },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
export const COMPARISON_FLEXES = [2.4, 1.25, 1.25, 1.3, 1.25, 1.25];

export function comparisonRowCells(c: MeasurementComparisonRow): (string | null)[] {
  if (c.is_section_header) {
    // Section header row (one per piece in the comparativa). The renderer
    // is expected to use the `is_section_header` flag to format this row
    // as a bold "COCINA" / "PARRILLA" band spanning the table; the string
    // cells are filled with empty strings so the totals line is the only
    // place that shows numbers.
    return [c.concepto, null, null, null, null, null];
  }
  if (c.is_detail) {
    // Indented detail row (zócalo/frente): indent the label, show the
    // monetary subtotals and — when a measure (m² / ml) exists — the unit-aware
    // Presupuestado/Real/Diferencia columns. Legacy rows without a dimensional
    // snapshot leave them as '—'.
    const INDENT = '\u00A0\u00A0\u00A0\u00A0';
    return [
      `${INDENT}${c.concepto}`,
      c.measure_budgeted_str || null,
      c.measure_real_str || null,
      c.measure_delta_str || null,
      c.subtotal_ars_str ? `$ ${c.subtotal_ars_str}` : null,
      c.subtotal_usd_str ? `USD ${c.subtotal_usd_str}` : null,
    ];
  }
  return [
    c.concepto,
    c.measure_budgeted_str || (c.m2_budgeted_str ? `${c.m2_budgeted_str} m²` : null),
    c.measure_real_str || (c.m2_real_str ? `${c.m2_real_str} m²` : '-'),
    c.measure_delta_str || (c.delta_str ? `${c.delta_str} m²` : null),
    c.subtotal_ars_str ? `$ ${c.subtotal_ars_str}` : null,
    c.subtotal_usd_str ? `USD ${c.subtotal_usd_str}` : null,
  ];
}

export function comparisonRowsWithTotal(comparison: MeasurementComparisonRow[]): (string | null)[][] {
  const rowCells = comparison.map(comparisonRowCells);
  if (comparison.length === 0) return rowCells;
  const totalArs = comparison.reduce((s, r) => s + Number(r.subtotal_ars || 0), 0);
  const totalUsd = comparison.reduce((s, r) => s + Number(r.subtotal_usd || 0), 0);
  const signed = (v: number): string => (v > 0 ? `+${fmt(v)}` : fmt(v));
  rowCells.push([
    'TOTAL',
    null,
    null,
    null,
    `$ ${signed(totalArs)}`,
    `USD ${signed(totalUsd)}`,
  ]);
  return rowCells;
}

/** Parallel array to `comparisonRowsWithTotal`. Returns `true` at index
 *  i when the i-th row is a section header (rendered as a bold band
 *  spanning every column). Used by `DataTable` to draw the per-piece
 *  grouping in the comparativa. */
export function comparisonSectionHeaderFlags(
  comparison: MeasurementComparisonRow[],
  rowCells?: (string | null)[][],
): boolean[] {
  // When the caller already computed `rowCells`, derive flags from the
  // `is_section_header` flag on the source row (avoid re-running
  // `comparisonRowCells`). The TOTAL row appended at the bottom is NOT
  // a section header.
  const flags = comparison.map((r) => Boolean(r.is_section_header));
  if (rowCells) {
    // rowCells may include a trailing TOTAL row — only mirror flags up
    // to the comparison's length.
    return flags;
  }
  return flags;
}

export function adicRowCells(a: AdditionalWorkPdfRow): (string | null)[] {
  const priceLabel = a.type === 'frente' ? `$ ${a.price_str} x ml` : `$ ${a.price_str}`;
  return [
    a.name,
    a.detail,
    String(a.quantity),
    priceLabel,
    a.currency,
    a.subtotal_ars > 0 ? `$ ${fmt(a.subtotal_ars)}` : null,
    a.subtotal_usd > 0 ? `USD ${fmt(a.subtotal_usd)}` : null,
  ];
}

/** For `frente` rows the picker freezes a small audit trail
 *  (`formula_values` on the JSON snapshot) that explains how the
 *  price/ml was derived. We surface it as a small line under the row so
 *  the customer can verify the inputs without taking the catalogue on
 *  faith. Returns `null` for non-`frente` rows.
 *
 *  Multiplicative formula (per business rule):
 *      price/ml = price_m² × 0.13 × multiplier
 *      total    = price_m² × 0.13 × multiplier × linear_meters */
export function adicRowBreakdown(a: AdditionalWorkPdfRow): string | null {
  if (a.type !== 'frente') return null;
  const m2 = a.material_price_per_m2_str;
  const multiplier = a.formula_constant_str;
  if (!m2 || !multiplier) return null;
  return `Calculado: $ ${m2}/m² × 0.13 × ${multiplier} × ${a.linear_meters_str ?? '—'}`;
}

export function fabRowCells(d: PdfDataRow): (string | null)[] {
  return [
    d.concept,
    d.detail,
    d.material,
    d.show_length && d.length_str ? d.length_str : null,
    d.show_width && d.width_str ? d.width_str : null,
    d.show_m2 ? d.m2_label : d.show_quantity ? String(d.quantity) : null,
    d.show_m2 && d.price_per_m2_str ? `$ ${d.price_per_m2_str}/m²` : `$ ${d.price_str}`,
    d.labor_str ? `$ ${d.labor_str}` : null,
    d.currency,
    d.subtotal_ars > 0 ? `$ ${fmt(d.subtotal_ars)}` : null,
    d.subtotal_usd > 0 ? `USD ${fmt(d.subtotal_usd)}` : null,
  ];
}

export function matRowCells(m: MaterialPdfRow): (string | null)[] {
  return [
    m.name,
    m.color,
    m.length_str,
    m.width_str,
    String(m.quantity),
    m.m2_str,
    `$ ${m.price_m2_str}`,
    m.currency,
    m.subtotal_ars > 0 ? `$ ${fmt(m.subtotal_ars)}` : null,
    m.subtotal_usd > 0 ? `USD ${fmt(m.subtotal_usd)}` : null,
  ];
}

export function poolRowCells(p: PoolPdfRow): (string | null)[] {
  return [
    p.brand,
    p.model,
    String(p.quantity),
    `$ ${p.price_str}`,
    p.currency,
    p.subtotal_ars > 0 ? `$ ${fmt(p.subtotal_ars)}` : null,
    p.subtotal_usd > 0 ? `USD ${fmt(p.subtotal_usd)}` : null,
  ];
}