/**
 * React-PDF document definition for the AFAMAR budget and work-order PDFs.
 *
 * Single source of truth for both document types — the `document_type`
 * prop drives title + which terms block renders. Mirrors the visual layout
 * of the legacy `app/templates/document_pdf.html` (xhtml2pdf + Jinja2),
 * but rendered with `@react-pdf/renderer` so the text is selectable, the
 * layouts flow between pages automatically, and the layout is unaffected
 * by the host OS.
 *
 * NOTE: react-pdf ships a `<Font/>` registry override; embeding Helvetica
 * is unnecessary because it's a default PDF font.
 */
import React, { Fragment } from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import type { PdfDocumentData, MaterialSection, PiecesPdfPiece, PieceAlternativeTotal } from '../../../utils/pdf/buildPdfData';
import { API_URL } from '../../../api/http';
import { BANK_INFO, PAYMENT_METHOD_TRANSFER, SKETCH_STAGE_WIDTH, SKETCH_STAGE_HEIGHT } from '../../../constants';

// The croquis rectángulo que ve el usuario en el editor es el `Stage` de
// Konva con tamaño fijo `SKETCH_STAGE_WIDTH × SKETCH_STAGE_HEIGHT`
// (definido en `components/sketch/CanvasArea`). El `SketchImageExtractor`
// re-renderiza el mismo contenido a esa resolución y exporta un PNG.
//
// Para que el PDF muestre el **mismo rectángulo** (mismo aspect ratio, no
// un rectángulo más chico con bandas negras), el frame de la sección
// "Croquis" tiene que tener exactamente el aspect ratio del stage. El
// ancho se calcula para ocupar casi todo el content area del PDF; la
// altura sale del aspect ratio.
const SKETCH_STAGE_ASPECT = SKETCH_STAGE_WIDTH / SKETCH_STAGE_HEIGHT;
// A4 portrait = 595pt, paddingHorizontal 34pt → content area ≈ 527pt.
const SKETCH_CONTENT_WIDTH = 527;
// A4 landscape = 842pt, paddingHorizontal 34pt → content area ≈ 774pt.
const SKETCH_CONTENT_WIDTH_LANDSCAPE = 774;
// Two display sizes for the croquis frame:
//  - SKETCH_PDF_WIDTH (≈460pt) is the inline size used when the croquis
//    shares a page with the rest of the document — leaves room for the
//    items table + totals + terms below it.
//  - SKETCH_PDF_LARGE_WIDTH (≈766pt, landscape A4) is the dedicated-page
//    size — when the croquis gets its own A4 page, we flip the page to
//    landscape so the wide editor rectángulo has room to breathe (A4
//    portrait leaves ~630pt of blank space below a 210pt-tall croquis;
//    landscape with the same content width gives 313pt of height).
const SKETCH_PDF_WIDTH = 460;
const SKETCH_PDF_HEIGHT = SKETCH_PDF_WIDTH / SKETCH_STAGE_ASPECT;
const SKETCH_PDF_LARGE_WIDTH = SKETCH_CONTENT_WIDTH_LANDSCAPE - 8; // 4pt margin each side
const SKETCH_PDF_LARGE_HEIGHT = SKETCH_PDF_LARGE_WIDTH / SKETCH_STAGE_ASPECT;

const FONT = 'Helvetica';
const ACCENT = '#c0392b';
const HEADER_RED = '#c0392b';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const SLATE_200 = '#e2e8f0';
const SLATE_100 = '#f1f5f9';
const SLATE_50 = '#f8fafc';
const AMBER_700 = '#92400e';
const AMBER_200 = '#fde68a';
const AMBER_50 = '#fffbeb';
const BLUE_700 = '#1e40af';
const YELLOW_50 = '#fef9c3';
const TEXT_DARK = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    lineHeight: 1.4,
    color: TEXT_DARK,
    paddingTop: 14 * 2.83,
    paddingBottom: 16 * 2.83,
    paddingHorizontal: 12 * 2.83,
  },
  // ===== HEADER (fixed — repeats on every page automatically) =====
  // The membrete (logo, datos de la empresa, N° de presupuesto, subtítulo)
  // sits at the very top of every page via the `fixed` prop. Position
  // absolute + top/left/right pinned to the page padding so it lines up
  // with the rest of the content. The page keeps its `paddingTop` so the
  // first body row starts below the header.
  headerFixed: {
    position: 'absolute',
    top: 8 * 2.83,
    left: 12 * 2.83,
    right: 12 * 2.83,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  // Stack the logo ABOVE the identity text (tagline / address / phone /
  // email). The old side-by-side layout pushed "MÁRMOLES & GRANITOS" to the
  // right of the logo; the header now reads top-down: LOGO → TAGLINE →
  // contact lines (2026-09-25 mañana).
  headerLeft: { width: '65%', flexDirection: 'column', alignItems: 'flex-start' },
  // Logo container — capped at 140px (ceiling 150) so the AFAMAR mark
  // never stretches past ~35% of the column even on a wide logo (2026-09-25
  // mañana). The previous `width: '100%'` made it consume every pixel the
  // column had, so the tagline underneath looked crammed.
  headerLeftLogo: { width: 140, maxWidth: 150, alignItems: 'flex-start' },
  headerLeftInfo: { width: '100%', marginTop: 6 },
  headerRight: { width: '35%', textAlign: 'right' },
  // Logo image itself: width 140 (matches the container), height auto
  // preserves the source aspect ratio. `objectFit` is dropped because
  // the image now has natural dimensions.
  logo: { width: 140, height: 'auto', maxHeight: 70, marginBottom: 0 },
  tagline: { fontSize: 10, fontWeight: 'bold', color: SLATE_700, lineHeight: 1.2, marginBottom: 2 },
  contactLine: { fontSize: 8, color: SLATE_700, lineHeight: 1.4 },
  docTitle: { fontSize: 13, fontWeight: 'bold', color: HEADER_RED, lineHeight: 1.2, marginTop: 4 },
  docNumber: { fontSize: 18, fontWeight: 'bold', color: HEADER_RED, fontFamily: 'Courier', marginTop: 2 },
  docSub: { fontSize: 8, color: SLATE_500, marginTop: 2 },
  // Validity line ("Presupuesto válido por X días") — marginTop bumped to
  // 8 so the line breathes below the document number (the previous 2 made
  // "P-XXXXXX" and the validity text visually collide).
  validityText: { fontSize: 8.5, fontWeight: 'bold', color: '#92400e', marginTop: 8, textAlign: 'right' },
  divider: { borderTop: `1px solid ${HEADER_RED}`, marginBottom: 4 },
  dividerLight: { borderTop: `1px solid ${SLATE_200}`, marginVertical: 2 },
  // ===== INFO-GRID =====
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  infoCell: { width: '50%', fontSize: 8.5, marginBottom: 2, paddingRight: 6 },
  label: { fontWeight: 'bold' },
  value: { fontWeight: 'bold', color: '#0f172a' },
  // ===== OBS BOX =====
  obsBox: { backgroundColor: AMBER_50, border: `1px solid ${AMBER_200}`, padding: 6, marginBottom: 4 },
  obsTitle: { fontSize: 8, fontWeight: 'bold', color: AMBER_700, textTransform: 'uppercase', marginBottom: 2 },
  obsText: { fontSize: 8.5 },
  obsList: { fontSize: 8.5, marginTop: 2 },
  obsListItem: { marginBottom: 2 },
  // ===== OPTION SECTION BLOCK (per-material breakdown) =====
  // Each section is a self-contained card with its own tables + subtotal so
  // the reader can see "PRINCIPAL: GRIS MARA" / "ALTERNATIVA 1: TAJ MAHAL" as
  // independent quotes (the customer only executes one).
  optSectionBlock: { marginTop: 4, marginBottom: 4, padding: 6, border: `1px solid ${SLATE_200}`, borderRadius: 4 },
  optSectionBlockMain: { borderColor: HEADER_RED, backgroundColor: '#fef9f9' },
  optSectionBlockAlt: { borderColor: SLATE_400, backgroundColor: SLATE_50 },
  optSectionTitle: { fontSize: 10, fontWeight: 'bold', color: HEADER_RED, textTransform: 'uppercase', marginBottom: 4, paddingBottom: 2, borderBottom: `1px solid ${HEADER_RED}` },
  optSectionTitleAlt: { color: SLATE_700, borderBottomColor: SLATE_400 },
  optSectionSubtotal: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, paddingTop: 3, borderTop: `1px dashed ${SLATE_200}` },
  optSectionSubtotalLbl: { fontSize: 8, fontWeight: 'bold', color: SLATE_700, marginRight: 8 },
  optSectionSubtotalVal: { fontSize: 9, fontWeight: 'bold', color: HEADER_RED },
  optSectionSubtotalUsd: { fontSize: 8, color: BLUE_700, marginLeft: 6 },
  // Consolidated TOTAL GENERAL ALTERNATIVO block (end of the HOJA DE
  // ALTERNATIVAS) — highlighted summary per alternative material.
  altTotalsBlock: {
    marginTop: 6,
    marginBottom: 4,
    padding: 6,
    border: `1px solid ${AMBER_200}`,
    borderLeft: `4px solid ${AMBER_700}`,
    backgroundColor: AMBER_50,
    borderRadius: 4,
  },
  altTotalsPieces: { fontSize: 7.5, color: SLATE_500, marginBottom: 2 },
  optAdicionalBreakdown: { fontSize: 7, color: SLATE_500, fontStyle: 'italic', marginTop: 1 },
  // ===== SECTION TITLE =====
  // ===== CROQUIS =====
  // The sketch image is rendered at the same aspect ratio as the editor's
  // `Stage` (see `SKETCH_STAGE_WIDTH` / `SKETCH_STAGE_HEIGHT` in
  // `constants/index.ts`). Two size variants — `sketchImg` for the
  // inline case (shares the page with items + totals) and
  // `sketchImgLarge` for the dedicated-page case (one Page, one big
  // rectángulo del croquis).
  sketchBox: { backgroundColor: SLATE_50, border: `1px solid ${SLATE_200}`, padding: 6, marginBottom: 8 },
  sketchTitle: { fontSize: 8, fontWeight: 'bold', color: SLATE_700, textTransform: 'uppercase', marginBottom: 2 },
  sketchImg: { width: SKETCH_PDF_WIDTH, height: SKETCH_PDF_HEIGHT, marginVertical: 4 },
  sketchImgLarge: { width: SKETCH_PDF_LARGE_WIDTH, height: SKETCH_PDF_LARGE_HEIGHT, marginVertical: 4 },
  // ===== SECTION TITLE =====
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: ACCENT, textTransform: 'uppercase', marginTop: 4, marginBottom: 2, paddingBottom: 2, borderBottom: `1px solid ${ACCENT}` },
  // ===== DATA TABLE =====
  // Each column is a <View> with flex — this keeps headers and cells aligned
  // because the flex ratio is identical on every row.
  tableHead: { flexDirection: 'row', backgroundColor: SLATE_100, borderBottom: `1px solid ${SLATE_400}` },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${SLATE_200}` },
  cell: { paddingVertical: 3, paddingHorizontal: 5, borderRight: `1px solid ${SLATE_200}` },
  cellLast: { paddingVertical: 3, paddingHorizontal: 5 },
  thText: { fontSize: 6.5, fontWeight: 'bold', color: SLATE_700 },
  thTextNum: { fontSize: 6.5, fontWeight: 'bold', color: SLATE_700, textAlign: 'right' },
  tdText: { fontSize: 7.5 },
  tdTextNum: { fontSize: 7.5, textAlign: 'right' },
  dash: { color: SLATE_500 },
  // ===== TOTALS =====
  totals: { marginTop: 2 },
  // Two-column totals layout (2026-09-25 tarde):
  //   LEFT  (~30%) — Dólar del día (date/time/rate)
  //   RIGHT (~70%) — Subtotal → Traslado → Descuento → Interés → TOTAL
  //                  (blue) → Seña/Pagos Registrados → Saldo pendiente
  // The right column hosts the existing vertical `totalsRow` stack; the
  // layout here only sets the side-by-side arrangement and widths so the
  // visual flow matches the requirement (no orphan "Dólar" line below the
  // totals anymore).
  totalsLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  totalsLayoutLeft: { width: '32%', paddingRight: 6, paddingTop: 4 },
  totalsLayoutRight: { width: '68%' },
  totalsUsdLabel: { fontSize: 8, fontWeight: 'bold', color: SLATE_700, marginBottom: 1 },
  totalsUsdDate: { fontSize: 7, color: SLATE_500, marginBottom: 2 },
  totalsUsdRate: { fontSize: 11, fontWeight: 'bold', color: BLUE_700 },
  totalsRow: { flexDirection: 'row', paddingVertical: 2 },
  totalsLbl: { width: '70%', textAlign: 'right', color: SLATE_700 },
  totalsVal: { width: '30%', textAlign: 'right', fontWeight: 'bold' },
  // Seña row carries both currencies stacked vertically inside the value
  // cell so the label can stay right-aligned at the same width as the
  // other totals rows (70% / 30%). The native amount is bold + the
  // same size; the ARS/USD equivalent is rendered just below in a
  // smaller, lighter weight so the line never overflows the 30% cell.
  totalsLblSeña: { width: '70%' },
  totalsValSeña: {
    width: '30%',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  totalsValPrimary: { fontWeight: 'bold', textAlign: 'right' },
  totalsValSecondary: { fontSize: 9, fontWeight: 'bold', textAlign: 'right', opacity: 0.7 },
  grand: { flexDirection: 'row', backgroundColor: BLUE_700, paddingVertical: 6, paddingHorizontal: 8, marginTop: 4 },
  grandLbl: { width: '70%', color: '#fff', fontWeight: 'bold' },
  grandVal: { width: '30%', color: '#fff', fontWeight: 'bold', textAlign: 'right' },
  grandUsdSub: { fontSize: 8, color: '#fff', opacity: 0.85 },
  // ===== PAYMENT METHOD =====
  paymentRow: { fontSize: 6.5, marginTop: 4, marginBottom: 4 },
  // Per-cuota breakdown (credit-card surcharges). Renders a compact
  // 3-column table under the recargo line: Cuota # | Interés | Monto.
  installmentTable: { marginTop: 4, marginBottom: 4, marginLeft: 8 },
  installmentHeader: {
    flexDirection: 'row',
    backgroundColor: SLATE_100,
    borderBottom: `1px solid ${SLATE_400}`,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  installmentHeaderCell: { fontSize: 7, fontWeight: 'bold', color: SLATE_700 },
  installmentHeaderN: { width: '20%' },
  installmentHeaderPct: { width: '35%', textAlign: 'right' },
  installmentHeaderAmount: { width: '45%', textAlign: 'right' },
  installmentRow: {
    flexDirection: 'row',
    borderBottom: `0.5px solid ${SLATE_200}`,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  installmentCell: { fontSize: 7, color: SLATE_700 },
  // Bank details block printed under the payment method when the
  // customer picks "Transferencia Bancaria". Slightly indented and
  // muted to make it clear it's a follow-up detail, not a new section.
  bankRow: { fontSize: 6.5, marginLeft: 8, marginTop: 0, marginBottom: 4, color: SLATE_700 },
  // ===== TERMS =====
  // The first term block (Condiciones de entrega / Términos del
  // presupuesto) shares a row with the METODO DE PAGO reference box so
  // both sit side by side, then Garantía appears full-width below.
  termsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  termsRowCol: { flex: 1, marginRight: 8 },
  termsBox: { marginTop: 6, backgroundColor: SLATE_50, border: `1px solid ${SLATE_200}`, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6 },
  termsTitle: { fontSize: 6.5, fontWeight: 'bold', color: BLUE_700, textTransform: 'uppercase', lineHeight: 1.1 },
  termsText: { fontSize: 6, lineHeight: 1.05 },
  termsListItem: { fontSize: 6, lineHeight: 1.05 },
  // ===== PAYMENT METHODS CATALOGUE (reference box) =====
  // Lists the active payment methods from /admin/configuration/payment-methods
  // so the customer sees every way they can pay. Renders next to the
  // delivery-conditions column in `termsRow` (right side, same row).
  paymentMethodsBox: { flex: 1, marginTop: 6, backgroundColor: SLATE_50, border: `1px solid ${SLATE_200}`, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6 },
  paymentMethodsItem: { fontSize: 6.5, lineHeight: 1.3 },
  // ===== SIGNATURES =====
  signatures: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30 },
  signatureCell: { width: '25%', textAlign: 'center' },
  signatureLine: { borderTopWidth: 0.5, borderTopColor: TEXT_DARK, height: 1 },
  signatureCaption: { fontSize: 4, color: SLATE_500, lineHeight: 1.05 },
  // ===== FOOTER =====
  footer: { position: 'absolute', bottom: 2 * 2.83, left: 12 * 2.83, right: 12 * 2.83, textAlign: 'center', fontSize: 5, color: SLATE_500, lineHeight: 1 },
  emptyRow: { fontSize: 8, color: SLATE_500, fontStyle: 'italic', paddingVertical: 4 },
});

function fmt(v: number): string {
  return (v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format the USD rate fetched-at timestamp as a short DD/MM/YYYY HH:mm
 *  string for the PDF footer. Returns an empty string if the input is
 *  unparseable so the parent can render the label without a date. */
function formatUsdFetchedAt(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Build the absolute URL for the company logo (served from /uploads/logo.png).
 *  Falls back to no logo when company_logo is empty. */
function logoUrl(company: PdfDocumentData['company']): string | null {
  const path = company.company_logo || '/uploads/logo.png';
  // API_URL has the form "/api/v1" — strip the trailing v1 path segment to
  // reach the same host root the uploads are served from.
  const base = API_URL.endsWith('/api/v1') ? API_URL.slice(0, -'/api/v1'.length) : '';
  if (!path) return null;
  return path.startsWith('http') ? path : `${base}${path}`;
}

interface DocumentPdfProps {
  data: PdfDocumentData;
}

/** DataTable that adapts columns to whatever data is present so we don't
 *  have to keep three builders in lockstep: fabrication, materials, pools.
 *  Each cell is wrapped in a <View flex={n}> so the column width is identical
 *  on the header and every row — this is what makes them align in react-pdf. */
function DataTable({
  headers,
  rows,
  flexes,
  clean = false,
}: {
  headers: { label: string; num?: boolean }[];
  rows: (string | null)[][];
  flexes?: number[];
  /** "Clean" mode (Conceptos / Adicionales): rows where EVERY cell is
   *  empty are dropped, columns where EVERY cell is empty are dropped
   *  (header + flex included), and the remaining empty cells render blank
   *  instead of the `—` placeholder — no orphan dashes, no empty columns. */
  clean?: boolean;
}) {
  if (rows.length === 0) return null;

  const nonEmpty = (c: string | null) => c != null && c !== '';
  let keptRows = rows;
  let keptHeaders = headers;
  let keptFlexes = flexes;
  if (clean) {
    keptRows = rows.filter((row) => row.some(nonEmpty));
    if (keptRows.length === 0) return null;
    const keptCols = headers.map((_, ci) => keptRows.some((row) => nonEmpty(row[ci])));
    if (keptCols.every((k) => !k)) return null;
    keptHeaders = headers.filter((_, ci) => keptCols[ci]);
    keptFlexes = flexes ? flexes.filter((_, ci) => keptCols[ci]) : undefined;
    keptRows = keptRows.map((row) => row.filter((_, ci) => keptCols[ci]));
  }

  const colFlex = (i: number) => (keptFlexes && keptFlexes[i] != null ? keptFlexes[i] : 1);

  return (
    <View>
      <View style={styles.tableHead}>
        {keptHeaders.map((h, i) => {
          const isLast = i === keptHeaders.length - 1;
          return (
            <View key={h.label} style={{ flex: colFlex(i), ...(isLast ? styles.cellLast : styles.cell) }}>
              <Text style={h.num ? styles.thTextNum : styles.thText}>{h.label}</Text>
            </View>
          );
        })}
      </View>
      {keptRows.map((row, ri) => (
        <View key={String(row[0] ?? `row-${ri}`)} style={styles.tableRow}>
          {row.map((cell, ci) => {
            const isLast = ci === row.length - 1;
            const isDash = cell == null || cell === '';
            const value = isDash ? (clean ? '' : '—') : cell;
            return (
              <View key={keptHeaders[ci]?.label ?? `cell-${ci}`} style={{ flex: colFlex(ci), ...(isLast ? styles.cellLast : styles.cell) }}>
                <Text style={keptHeaders[ci]?.num ? styles.tdTextNum : styles.tdText}>
                  {isDash ? <Text style={{ color: SLATE_500 }}>{value}</Text> : value}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.infoCell}>
      <Text>
        <Text style={styles.label}>{label}: </Text>
        <Text style={styles.value}>{value}</Text>
      </Text>
    </View>
  );
}

function ObsBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.obsBox}>
      <Text style={styles.obsTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TermsList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.termsBox} wrap={false}>
      <Text style={styles.termsTitle}>{title}</Text>
      {items.map((t) => (
        <Text key={t} style={styles.termsListItem}>{`• ${t}`}</Text>
      ))}
    </View>
  );
}

// ===== Option section: one self-contained block per material/alternative =====
//
// Each block is rendered as a card with a colored border (red = principal,
// gray = alternative) and includes its own material / pool / fabrication
// tables + subtotal. The common "Extras / Global" fabrication details and
// global pools are folded into every section's rows, so each option shows
// its full price at a glance. Alternatives are quoted but their subtotals
// do NOT add into the document grand total — the customer only executes
// one of them.

const FAB_HEADERS = [
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
const FAB_FLEXES = [2, 2.8, 1.6, 0.6, 0.6, 0.5, 0.9, 0.9, 0.5, 1.1, 1.1];

const MAT_HEADERS = [
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
const MAT_FLEXES = [2.4, 1.4, 0.6, 0.6, 0.4, 0.8, 1, 0.5, 1.2, 1.2];

const POOL_HEADERS = [
  { label: 'Marca' },
  { label: 'Modelo' },
  { label: 'Cant.', num: true },
  { label: 'Precio', num: true },
  { label: 'Mon.' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
const POOL_FLEXES = [2, 2, 0.4, 1, 0.5, 1.2, 1.2];

const ADDITIONAL_WORKS_HEADERS = [
  { label: 'Adicional' },
  { label: 'Detalle' },
  { label: 'Cant.', num: true },
  { label: 'Precio', num: true },
  { label: 'Mon.' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
const ADDITIONAL_WORKS_FLEXES = [2, 2.4, 0.4, 1, 0.5, 1.2, 1.2];

const COMPARISON_HEADERS = [
  { label: 'Concepto' },
  { label: 'Presupuestado', num: true },
  { label: 'Real', num: true },
  { label: 'Diferencia', num: true },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
const COMPARISON_FLEXES = [2.4, 1.25, 1.25, 1.3, 1.25, 1.25];

function comparisonRowCells(
  c: import('../../../utils/pdf/buildPdfData').MeasurementComparisonRow,
): (string | null)[] {
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

function comparisonRowsWithTotal(
  comparison: import('../../../utils/pdf/buildPdfData').MeasurementComparisonRow[],
): (string | null)[][] {
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

function adicRowCells(a: import('../../../utils/pdf/buildPdfData').AdditionalWorkPdfRow): (string | null)[] {  const priceLabel = a.type === 'frente' ? `$ ${a.price_str} x ml` : `$ ${a.price_str}`;
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
function adicRowBreakdown(
  a: import('../../../utils/pdf/buildPdfData').AdditionalWorkPdfRow,
): string | null {
  if (a.type !== 'frente') return null;
  const m2 = a.material_price_per_m2_str;
  const multiplier = a.formula_constant_str;
  if (!m2 || !multiplier) return null;
  return `Calculado: $ ${m2}/m² × 0.13 × ${multiplier} × ${a.linear_meters_str ?? '—'}`;
}

function fabRowCells(d: import('../../../utils/pdf/buildPdfData').PdfDataRow): (string | null)[] {
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

function matRowCells(m: import('../../../utils/pdf/buildPdfData').MaterialPdfRow): (string | null)[] {
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

function poolRowCells(p: import('../../../utils/pdf/buildPdfData').PoolPdfRow): (string | null)[] {
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

function OptionSectionBlock({ section }: { section: MaterialSection }) {
  // Pick the card chrome based on whether this is the main option or an
  // alternative. There's no separate global card anymore — the common
  // extras are folded into every section's rows so the customer sees the
  // full price of each option in a single block.
  const blockStyle = section.is_main
    ? styles.optSectionBlockMain
    : styles.optSectionBlockAlt;
  const titleStyle = section.is_main
    ? [styles.optSectionTitle]
    : [styles.optSectionTitle, styles.optSectionTitleAlt];

  const fabRows = section.fabrication_details.map(fabRowCells);
  const matRows = section.materials.map(matRowCells);
  const poolRows = section.pools.map(poolRowCells);
  const adicRows = (section.additional_works || []).map(adicRowCells);

  const hasContent =
    fabRows.length > 0 || matRows.length > 0 || poolRows.length > 0 || adicRows.length > 0;
  if (!hasContent) return null;

  return (
    // No `wrap={false}` here: when a section is too large to fit on the
    // remaining space of the current page, the content needs to flow
    // across pages (otherwise the first page renders empty with just the
    // header/footer, and everything starts on page 2). The card chrome
    // (border/background) will visually repeat at the start of the new
    // page, which is acceptable for a long table.
    <View style={{ ...styles.optSectionBlock, ...blockStyle }}>
      <Text style={titleStyle}>{section.title}</Text>

      {matRows.length > 0 ? (
        <DataTable headers={MAT_HEADERS} rows={matRows} flexes={MAT_FLEXES} />
      ) : null}

      {fabRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={FAB_HEADERS} rows={fabRows} flexes={FAB_FLEXES} clean />
        </View>
      ) : null}

      {poolRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={POOL_HEADERS} rows={poolRows} flexes={POOL_FLEXES} />
        </View>
      ) : null}

      {adicRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={ADDITIONAL_WORKS_HEADERS} rows={adicRows} flexes={ADDITIONAL_WORKS_FLEXES} clean />
        </View>
      ) : null}

      <View style={styles.optSectionSubtotal}>
        <Text style={styles.optSectionSubtotalLbl}>
          {section.is_main ? 'Subtotal Sección' : 'Subtotal Opción'}
        </Text>
        <Text style={styles.optSectionSubtotalVal}>
          {`$ ${fmt(section.subtotal_ars)}`}
        </Text>
        {section.subtotal_usd > 0 ? (
          <Text style={styles.optSectionSubtotalUsd}>
            {`(USD ${fmt(section.subtotal_usd)})`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ===== Multi-piece layout =====
//
// A multi-piece budget stores each mesada in `data.pieces`. Page 1 prints
// one self-contained block per piece (materials + zócalo/frente + additional
// works + pools + subtotal). Page 2 prints the "hoja de alternativas",
// grouped by piece, with one full option block per alternative (the piece's
// pools, fabrication and additional works are inherited verbatim so the
// customer sees the complete price of swapping the material).

/**
 * Membrete (logo + datos de la empresa + N° de presupuesto + subtítulo).
 * Renders IN-FLOW at the top of each `<Page>` so the rest of the page
 * content (client grid, piece blocks, totals) flows naturally below it
 * with no overlap. Using `position: absolute` + `fixed` here caused the
 * client info to paint on top of the logo because the logo is much taller
 * than the page's `paddingTop` reserves.
 */
function DocumentHeader({ data }: { data: PdfDocumentData }) {
  const logo = logoUrl(data.company);
  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {logo ? (
            <View style={styles.headerLeftLogo}>
              <Image style={styles.logo} src={logo} />
            </View>
          ) : null}
          <View style={styles.headerLeftInfo}>
            {data.company.company_tagline ? (
              <Text style={styles.tagline}>{data.company.company_tagline}</Text>
            ) : null}
            {data.company.company_address ? (
              <Text style={styles.contactLine}>{data.company.company_address}</Text>
            ) : null}
            {data.company.company_phone ? (
              <Text style={styles.contactLine}>{`Tel: ${data.company.company_phone}`}</Text>
            ) : null}
            {data.company.company_email ? (
              <Text style={styles.contactLine}>{data.company.company_email}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.docTitle}>{data.title}</Text>
          <Text style={styles.docNumber}>{data.number || '—'}</Text>
          {/* Validity line (2026-09-25 mañana) — moved from below the header
              row to directly under the document number so it doesn't push
              the logo container down. Budget-only. */}
          {data.document_type === 'budget' && data.company.budget_validity_text ? (
            <Text style={styles.validityText}>{data.company.budget_validity_text}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.divider} />
    </View>
  );
}

function PieceBlock({ piece }: { piece: PiecesPdfPiece }) {
  const matRows = piece.materials.map(matRowCells);
  const fabRows = piece.fabrication_details.map(fabRowCells);
  const adicRows = piece.additional_works.map(adicRowCells);
  const poolRows = piece.pools.map(poolRowCells);
  const hasContent =
    matRows.length > 0 || fabRows.length > 0 || adicRows.length > 0 || poolRows.length > 0;
  if (!hasContent) return null;

  return (
    // `wrap={false}` keeps the whole piece card together — if it doesn't fit
    // on the remaining page, react-pdf moves the entire block to the next
    // page instead of splitting the tables across the page break. The card
    // chrome (border + title) travels with it so the customer still reads
    // it as a single block.
    <View style={{ ...styles.optSectionBlock, ...styles.optSectionBlockMain }} wrap={false}>
      <Text style={styles.optSectionTitle}>{`Pieza: ${piece.name}`}</Text>

      {matRows.length > 0 ? (
        <DataTable headers={MAT_HEADERS} rows={matRows} flexes={MAT_FLEXES} />
      ) : null}

      {fabRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={FAB_HEADERS} rows={fabRows} flexes={FAB_FLEXES} clean />
        </View>
      ) : null}

      {adicRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={ADDITIONAL_WORKS_HEADERS} rows={adicRows} flexes={ADDITIONAL_WORKS_FLEXES} clean />
        </View>
      ) : null}

      {poolRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.optAdicionalBreakdown}>Piletas</Text>
          <DataTable headers={POOL_HEADERS} rows={poolRows} flexes={POOL_FLEXES} />
        </View>
      ) : null}

      <View style={styles.optSectionSubtotal}>
        <Text style={styles.optSectionSubtotalLbl}>Subtotal Pieza</Text>
        <Text style={styles.optSectionSubtotalVal}>{`$ ${fmt(piece.subtotal_ars)}`}</Text>
        {piece.subtotal_usd > 0 ? (
          <Text style={styles.optSectionSubtotalUsd}>{`(USD ${fmt(piece.subtotal_usd)})`}</Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * HOJA DE ALTERNATIVAS — Page 2 in pieces mode. For each piece that has
 * alternatives, renders one self-contained block per alternative with the
 * swapped material + the piece's inherited zócalos, adicionales and
 * piletas + the option subtotal. `wrap={false}` keeps each alternative
 * block on a single page.
 */
function AlternativesSheet({ pieces }: { pieces: PiecesPdfPiece[] }) {
  const withAlternatives = pieces.filter((p) => p.alternatives.length > 0);
  if (withAlternatives.length === 0) return null;

  return (
    <>
      {withAlternatives.map((piece) => (
        <View key={piece.id || piece.name} wrap={false}>
          <Text style={styles.optSectionTitle}>{`${piece.name} — Alternativas de material`}</Text>

          {piece.alternatives.map((alt, i) => {
            const matRows = alt.materials.map(matRowCells);
            const fabRows = alt.fabrication_details.map(fabRowCells);
            const adicRows = alt.additional_works.map(adicRowCells);
            const poolRows = alt.pools.map(poolRowCells);
            const altLabel = alt.material_name || alt.title || `Alternativa ${i + 1}`;
            return (
              <View
                key={`${piece.id}-alt-${i}`}
                style={{ ...styles.optSectionBlock, ...styles.optSectionBlockAlt, marginTop: 4 }}
                wrap={false}
              >
                <Text style={[styles.optSectionTitle, styles.optSectionTitleAlt]}>
                  {`Alternativa ${i + 1}: ${altLabel}`}
                </Text>

                {matRows.length > 0 ? (
                  <DataTable headers={MAT_HEADERS} rows={matRows} flexes={MAT_FLEXES} />
                ) : null}

{fabRows.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    <DataTable headers={FAB_HEADERS} rows={fabRows} flexes={FAB_FLEXES} clean />
                  </View>
                ) : null}

                {adicRows.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    <DataTable headers={ADDITIONAL_WORKS_HEADERS} rows={adicRows} flexes={ADDITIONAL_WORKS_FLEXES} clean />
                  </View>
                ) : null}

                {poolRows.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.optAdicionalBreakdown}>Piletas (heredadas)</Text>
                    <DataTable headers={POOL_HEADERS} rows={poolRows} flexes={POOL_FLEXES} />
                  </View>
                ) : null}

                <View style={styles.optSectionSubtotal}>
                  <Text style={styles.optSectionSubtotalLbl}>Subtotal Opción Alternativa</Text>
                  <Text style={styles.optSectionSubtotalVal}>{`$ ${fmt(alt.subtotal_ars)}`}</Text>
                  {alt.subtotal_usd > 0 ? (
                    <Text style={styles.optSectionSubtotalUsd}>
                      {`(USD ${fmt(alt.subtotal_usd)})`}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

/**
 * TOTAL GENERAL ALTERNATIVO — highlighted summary blocks shown at the end of
 * the HOJA DE ALTERNATIVAS, ONE per alternative material CONSOLIDATED across
 * every piece that quotes it. Each block re-runs the document total rule set
 * (traslado + descuento comercial + recargo + seña) over the aggregated
 * alternative subtotals, so the customer sees the real final price of
 * choosing that material for the whole job, in both currencies.
 */
function AlternativeTotalsSummary({
  totals,
  showSaldo,
  usdRate,
  usdRateFetchedAt,
}: {
  totals: PieceAlternativeTotal[];
  showSaldo: boolean;
  /** Optional override for the per-document USD rate (the alternative
   *  block shares the page with the document-level totals, so we use
   *  the same number rather than recomputing per-piece). */
  usdRate?: number;
  usdRateFetchedAt?: string | null;
}) {
  if (!totals || totals.length === 0) return null;
  const formattedUsdRate = usdRate && usdRate > 0 ? fmt(usdRate) : '—';
  return (
    <>
      {totals.map((t) => (
        <View key={t.material_name} style={styles.altTotalsBlock} wrap={false}>
          <Text style={styles.optSectionTitle}>
            {`TOTAL GENERAL ALTERNATIVO (${t.material_name})`}
          </Text>
          <Text style={styles.altTotalsPieces}>
            {`Piezas: ${t.pieces.join(', ')}`}
          </Text>

          {/* Two-column totals layout (2026-09-25 tarde): LEFT = Dólar del
              día, RIGHT = Subtotal → Descuento → TOTAL → Saldo (in strict
              order). The alt block has no traslado/cuotas/observaciones. */}
          <View style={styles.totalsLayout}>
            <View style={styles.totalsLayoutLeft}>
              <Text style={styles.totalsUsdLabel}>Dólar del día</Text>
              {usdRateFetchedAt ? (
                <Text style={styles.totalsUsdDate}>
                  {formatUsdFetchedAt(usdRateFetchedAt)}
                </Text>
              ) : null}
              <Text style={styles.totalsUsdRate}>{`$ ${formattedUsdRate}`}</Text>
            </View>

            <View style={styles.totalsLayoutRight}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLbl}>Subtotal</Text>
                <Text style={styles.totalsVal}>{`$ ${fmt(t.subtotal_ars)}`}</Text>
              </View>
              {t.discount_fixed_amount > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLbl}>Descuento</Text>
                  <Text style={styles.totalsVal}>{`-$ ${fmt(t.discount_fixed_amount)}`}</Text>
                </View>
              ) : null}
              {t.surcharge_amount > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLbl}>Interés</Text>
                  <Text style={styles.totalsVal}>{`$ ${fmt(t.surcharge_amount)}`}</Text>
                </View>
              ) : null}

              <View style={[styles.grand, { marginTop: 4 }]}>
                <Text style={styles.grandLbl}>TOTAL GRAL ALTERNATIVO</Text>
                <Text style={styles.grandVal}>
                  {`$ ${fmt(t.total_ars)}`}
                  {t.total_usd > 0 ? (
                    <Text style={styles.grandUsdSub}>{`  (USD $${fmt(t.total_usd)})`}</Text>
                  ) : null}
                </Text>
              </View>

              {showSaldo && t.balance_due > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLbl}>Saldo pendiente</Text>
                  <Text style={styles.totalsVal}>{`$ ${fmt(t.balance_due)}`}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

export default function DocumentPdf({ data }: DocumentPdfProps) {
  // "Saldo pendiente" only makes sense when payments were actually
  // registered against this document: a work order always tracks payments,
  // a budget only when a seña was received. Without that, the row would just
  // repeat the TOTAL and mislead the customer.
  const showSaldo =
    data.document_type === 'work_order' ||
    data.deposit_received > 0 ||
    data.deposit_usd > 0;
  const clientGrid = (
    <View style={styles.infoGrid}>
      <InfoCell label="Cliente" value={data.client_name} />
      <InfoCell label="Teléfono" value={data.client_phone} />
      <InfoCell label="Domicilio" value={data.client_address} />
      <InfoCell label="Correo" value={data.client_email} />
      <InfoCell label="Fecha" value={data.date} />
      <InfoCell label="Fecha de Entrega" value={data.delivery_date} />
    </View>
  );

  const specsGrid = (
    <View style={styles.infoGrid}>
      <InfoCell label="Color" value={data.material_color} />
      <InfoCell label="Espesor" value={data.material_thickness} />
      <InfoCell label="Acabado" value={data.material_finish} />
    </View>
  );

  // The old flat fabrication/materials/pools headers + rows are now module-
  // level constants + helpers (FAB_HEADERS, MAT_HEADERS, POOL_HEADERS, fabRowCells,
  // matRowCells, poolRowCells) because each OptionSectionBlock now builds its
  // own rows from `data.sections[*]`.

  // Per-page terms (rendered on every page so each option quote is
  // self-contained with its own header/terms/footer). The first term block
  // (Condiciones de entrega on OTs / Términos del presupuesto on budgets)
  // is rendered side by side with the METODO DE PAGO reference box, then
  // Garantía goes full-width below.
  const termsBlock = (
    <>
      <View style={styles.termsRow}>
        {(data.document_type === 'budget'
          ? data.budget_terms_list
          : data.delivery_terms_list
        ).length > 0 ? (
          <View style={styles.termsRowCol}>
            {data.document_type === 'budget' ? (
              <TermsList title="Términos del presupuesto" items={data.budget_terms_list} />
            ) : (
              <TermsList title="Condiciones de entrega" items={data.delivery_terms_list} />
            )}
          </View>
        ) : null}
        {data.payment_methods_catalogue.length > 0 ? (
          <View style={styles.paymentMethodsBox}>
            <Text style={styles.termsTitle}>Metodo de pago</Text>
            {data.payment_methods_catalogue.map((name) => (
              <Text key={name} style={styles.paymentMethodsItem}>
                {name}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      <TermsList title="Garantía" items={data.warranty_terms_list} />
    </>
  );

  // Document-level totals + payment + signatures. Normally rendered only on
  // the principal page (where the customer signs the chosen option). When the
  // budget has NO principal material, every alternative is a standalone quote,
  // so this block is rendered on EACH alternative using that option's OWN
  // totals (`section.total_ars` etc., computed in buildPdfData) so all of
  // them show their correct final price regardless of how many alternatives
  // there are.
  const renderExtras = (section?: Partial<MaterialSection> | null) => (
    <>
      {/* COMPARATIVA DE MEDICIÓN — work orders only, per-order flag; the
          `measurement_comparison` array is empty when disabled */}
      {data.document_type === 'work_order' && data.measurement_comparison.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.sectionTitle}>Comparativa de medición</Text>
          <DataTable
            headers={COMPARISON_HEADERS}
            rows={comparisonRowsWithTotal(data.measurement_comparison)}
            flexes={COMPARISON_FLEXES}
          />
        </View>
      ) : null}

      {/* OBSERVATIONS — only on principal page */}
      {data.notes ? (
        <ObsBox title="Observaciones">
          <Text style={styles.obsText}>{data.notes}</Text>
        </ObsBox>
      ) : null}
      {data.important_observations ? (
        <ObsBox title="Observaciones importantes">
          {data.important_observations_list.length > 0 ? (
            data.important_observations_list.map((t) => (
              <Text key={t} style={styles.obsListItem}>{`• ${t}`}</Text>
            ))
          ) : (
            <Text style={styles.obsText}>{data.important_observations}</Text>
          )}
        </ObsBox>
      ) : null}

      {/* TOTALS — two-column layout (2026-09-25 tarde):
          LEFT  ~32% → Dólar del día (label / fecha+hora / cotización)
          RIGHT ~68% → Subtotal → Traslado → Descuento → Cat. Descuento
                       → Interés → Tabla de cuotas → TOTAL (barra azul)
                       → Seña / Pagos Registrados → Saldo pendiente
          The strict sequence SUBTOTAL → DESCUENTO → TOTAL → SALDO is
          preserved (Interés/Traslado/Cat-Desc/Cuotas are intermediate
          rows that don't break the user-facing hierarchy). */}
      <View style={styles.totalsLayout}>
        <View style={styles.totalsLayoutLeft}>
          <Text style={styles.totalsUsdLabel}>Dólar del día</Text>
          {data.usd_rate_fetched_at ? (
            <Text style={styles.totalsUsdDate}>
              {formatUsdFetchedAt(data.usd_rate_fetched_at)}
            </Text>
          ) : null}
          <Text style={styles.totalsUsdRate}>
            {`$ ${data.usd_rate > 0 ? fmt(data.usd_rate) : '—'}`}
          </Text>
        </View>

        <View style={styles.totalsLayoutRight}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLbl}>Subtotal</Text>
            <Text style={styles.totalsVal}>{`$ ${fmt(section?.subtotal_ars ?? data.subtotal)}`}</Text>
          </View>
          {data.transport > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>Traslado</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(data.transport)}`}</Text>
            </View>
          ) : null}
          {data.discount_fixed_amount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>
                {data.discount_percentage > 0
                  ? `Descuento (${data.discount_percentage}%)`
                  : 'Descuento'}
              </Text>
              <Text style={styles.totalsVal}>{`-$ ${fmt(section?.discount_fixed_amount ?? data.discount_fixed_amount)}`}</Text>
            </View>
          ) : null}
          {data.catalogue_discount_amount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>
                {`Descuento (${data.catalogue_discount_percentage}%) ${data.catalogue_method_label}`.trim()}
              </Text>
              <Text style={styles.totalsVal}>{`-$ ${fmt(data.catalogue_discount_amount)}`}</Text>
            </View>
          ) : null}
          {(section?.surcharge_percentage ?? data.surcharge_percentage) > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>Interés:</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(section?.surcharge_amount ?? data.surcharge_amount)}`}</Text>
            </View>
          ) : null}
          {(section?.catalogue_installment_detail ?? data.catalogue_installment_detail) && (section?.catalogue_installment_detail ?? data.catalogue_installment_detail).length > 1 ? (
            <View style={styles.installmentTable}>
              <View style={styles.installmentHeader}>
                <Text style={[styles.installmentHeaderCell, styles.installmentHeaderN]}>Cuota #</Text>
                <Text style={[styles.installmentHeaderCell, styles.installmentHeaderPct]}>Interés</Text>
                <Text style={[styles.installmentHeaderCell, styles.installmentHeaderAmount]}>Monto</Text>
              </View>
              {(section?.catalogue_installment_detail ?? data.catalogue_installment_detail).map((row) => (
                <View key={row.cuota} style={styles.installmentRow}>
                  <Text style={[styles.installmentCell, styles.installmentHeaderN]}>{row.cuota}</Text>
                  <Text style={[styles.installmentCell, styles.installmentHeaderPct]}>{`${row.interes}%`}</Text>
                  <Text style={[styles.installmentCell, styles.installmentHeaderAmount]}>{`$ ${fmt(row.monto)}`}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* TOTAL blue bar — sits at the bottom of the right column AFTER
              the descuentos/interés rows and BEFORE the seña/saldo, so the
              strict hierarchy SUBTOTAL → DESCUENTO → TOTAL → SALDO holds. */}
          <View style={[styles.grand, { marginTop: 4 }]}>
            <Text style={styles.grandLbl}>TOTAL</Text>
            <Text style={styles.grandVal}>
              {`$ ${fmt(section?.total_ars ?? data.total)}`}
              {(section?.total_usd ?? data.total_usd) > 0 ? <Text style={styles.grandUsdSub}>{`  (USD $${fmt(section?.total_usd ?? data.total_usd)})`}</Text> : null}
            </Text>
          </View>

          {data.document_type === 'work_order'
            ? (data.total_paid_ars > 0 || data.total_paid_usd > 0) ? (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLbl, styles.totalsLblSeña]}>
                  {data.paid_label || 'Seña / Pagos Registrados'}
                </Text>
                <View style={styles.totalsValSeña}>
                  <Text style={styles.totalsValPrimary}>
                    {`$ ${fmt(data.total_paid_ars)}`}
                  </Text>
                  <Text style={styles.totalsValSecondary}>
                    {data.total_paid_usd > 0 ? `USD ${fmt(data.total_paid_usd)}` : ''}
                  </Text>
                </View>
              </View>
            ) : null
            : (data.deposit_received > 0 || data.deposit_usd > 0) ? (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLbl, styles.totalsLblSeña]}>Seña</Text>
                <View style={styles.totalsValSeña}>
                  <Text style={styles.totalsValPrimary}>
                    {data.deposit_currency === 'USD'
                      ? `USD ${fmt(data.deposit_usd)}`
                      : `$ ${fmt(data.deposit_received)}`}
                  </Text>
                  <Text style={styles.totalsValSecondary}>
                    {data.deposit_currency === 'USD'
                      ? `$ ${fmt(data.deposit_ars_equivalent)}`
                      : data.usd_rate > 0
                        ? `USD ${fmt(data.deposit_received / data.usd_rate)}`
                        : ''}
                  </Text>
                </View>
              </View>
            ) : null}
          {(section?.balance_due ?? data.balance_due) > 0 &&
          (data.document_type === 'work_order' ||
            data.deposit_received > 0 ||
            data.deposit_usd > 0) ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>Saldo pendiente</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(section?.balance_due ?? data.balance_due)}`}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {data.payment_method ? (
        <View style={styles.paymentRow}>
          <Text>
            <Text style={styles.label}>Forma de pago: </Text>
            <Text>{data.payment_method}</Text>
            {(section?.catalogue_installment_detail ?? data.catalogue_installment_detail)?.length > 0 ? (
              <Text>
                {data.installments > 1
                  ? ` (${data.installments} cuotas con ${(section?.catalogue_installment_detail ?? data.catalogue_installment_detail)[0].interes}% de interés por cuota)`
                  : ` (con ${(section?.catalogue_installment_detail ?? data.catalogue_installment_detail)[0].interes}% de interés)`}
              </Text>
            ) : null}
          </Text>
          {data.payment_method === PAYMENT_METHOD_TRANSFER ? (
            <View style={styles.bankRow}>
              <Text>
                <Text style={styles.label}>{`ALIAS: `}</Text>
                <Text>{BANK_INFO.alias}</Text>
              </Text>
              <Text>
                <Text style={styles.label}>{`BANCO: `}</Text>
                <Text>{`${BANK_INFO.banco} a nombre de ${BANK_INFO.titular}`}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* SIGNATURES */}
      <View style={styles.signatures} wrap={false}>
        <View style={styles.signatureCell}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureCaption}>
            {`${data.company.company_name || 'AFAMAR'}\nResponsable`}
          </Text>
        </View>
        <View style={styles.signatureCell}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureCaption}>{'CLIENTE CONFORME\nFirma y aclaración'}</Text>
        </View>
      </View>
    </>
  );

  // Footer (auto-positioned at the bottom of every page via the `fixed` prop
  // and `position: absolute` style).
  const footer = data.company.pdf_footer ? (
    <Text style={styles.footer} fixed>
      {data.company.pdf_footer}
    </Text>
  ) : null;

  // When the budget has NO principal material (e.g. only alternatives), there
  // is no `is_main` section to host the totals/payment/signatures block. In
  // that case we render it on the FIRST alternative page so the document-level
  // totals (precio final, dólar del día, forma de pago, firmas) are still
  // visible even though every option is an alternative.
  const hasMainSection = (data.sections || []).some((s) => s.is_main);

  // Multi-piece budgets (budgets only) render the two-page pieces layout
  // instead of the legacy per-option sections.
  const pieces = data.pieces || [];
  const hasPieces = pieces.length > 0;
  const hasPieceAlternatives = pieces.some((p) => p.alternatives.length > 0);

  return (
    <Document title={`${data.title} ${data.number}`} author={data.company.company_name}>
      {hasPieces ? (
        <Fragment>
          {/* PAGE 1 — PRESUPUESTO PRINCIPAL: one block per piece */}
          <Page size="A4" style={styles.page} wrap>
            <DocumentHeader data={data} />
            {clientGrid}
            {specsGrid}

            {pieces.map((piece) => (
              <PieceBlock key={piece.id || piece.name} piece={piece} />
            ))}

            {/* In pieces mode pools live INSIDE each PieceBlock — no global
                Piletas block here (otherwise the same pileta would be
                printed twice: once per piece and once at document level). */}

            {termsBlock}
            {renderExtras(undefined)}
            {footer}
          </Page>

          {/* PAGE 2 — HOJA DE ALTERNATIVAS, grouped by piece. No `break`
              prop here (it was forcing a blank page between the main
              budget and the alternatives when page 1 still had room).
              Each alternative block is `wrap={false}` inside
              `AlternativesSheet`, so the flow is continuous and atomic:
              alternatives either fit at the bottom of page 1 or move
              cleanly to page 2 without intermediate blank pages. */}
          {hasPieceAlternatives ? (
            <Page size="A4" style={styles.page} wrap>
              <DocumentHeader data={data} />
              {clientGrid}
              <Text style={styles.sectionTitle}>Hoja de alternativas</Text>
              <AlternativesSheet pieces={pieces} />
              <AlternativeTotalsSummary
                totals={data.alternative_totals || []}
                showSaldo={showSaldo}
                usdRate={data.usd_rate}
                usdRateFetchedAt={data.usd_rate_fetched_at}
              />
              {footer}
            </Page>
          ) : null}

          {/* Dedicated croquis page (landscape), same treatment as the
              legacy layout so the drawing has room to breathe */}
          {data.sketch_images.length > 0 ? (
            <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
              {clientGrid}
              <View style={styles.sketchBox}>
                <Text style={styles.sketchTitle}>Plano</Text>
                {data.sketch_images.map((img, i) => (
                  <Image key={img.slice(0, 32) || `sketch-${i}`} style={styles.sketchImgLarge} src={img} />
                ))}
              </View>
              {footer}
            </Page>
          ) : null}
        </Fragment>
      ) : data.sections && data.sections.length > 0 ? (
        data.sections.map((section, index) => (
          <Fragment key={section.title}>
            <Page size="A4" style={styles.page} wrap>
              {/* HEADER — repeated on every page via the fixed component. */}
              <DocumentHeader data={data} />

              {/* CLIENT — shown on every page so each quote is self-contained */}
              {clientGrid}

              {/* SPECS — only on the principal page (the chosen one) */}
              {section.is_main ? specsGrid : null}

              {/* THE OPTION ITSELF — material + pools + fab + subtotal */}
              <OptionSectionBlock section={section} />

              {/* TERMS — on every page (per user request: each option quote is
                  self-contained with its own terms block) */}
              {termsBlock}

              {/* TOTALS / PAYMENT / SIGNATURES — on the principal page, or on
                  EVERY alternative when the budget has no principal material
                  (each option is its own self-contained quote with its own total) */}
              {section.is_main || !hasMainSection ? renderExtras(section) : null}

              {/* FOOTER — `fixed` makes it appear on every page automatically */}
              {footer}
            </Page>

            {/* Dedicated croquis page — only on the principal section, only
                if there's actually a croquis to show. Same header (fixed),
                client grid and footer so the page stands on its own.
                `wrap={false}` keeps the image intact (no risk of being
                split across pages). */}
            {section.is_main && data.sketch_images.length > 0 ? (
              <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
                <DocumentHeader data={data} />
                {clientGrid}
                <View style={styles.dividerLight} />
                <View style={styles.sketchBox}>
                  <Text style={styles.sketchTitle}>Plano</Text>
                  {data.sketch_images.map((img, i) => (
                    <Image key={img.slice(0, 32) || `sketch-${i}`} style={styles.sketchImgLarge} src={img} />
                  ))}
                </View>
                {footer}
              </Page>
            ) : null}
          </Fragment>
        ))
      ) : (
        // Legacy fallback: if `sections` is missing (e.g. an old buildPdfData
        // caller), render a single page with the flat lists the way the old
        // PDF did. If there's a croquis, the dedicated-page treatment below
        // adds it on its own A4 page.
        <Fragment>
          <Page size="A4" style={styles.page} wrap>
            <DocumentHeader data={data} />
            {clientGrid}
            {specsGrid}
            {data.materials.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Materiales</Text>
                <DataTable headers={MAT_HEADERS} rows={data.materials.map(matRowCells)} flexes={MAT_FLEXES} />
              </View>
            ) : null}
            {data.fabrication_details.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.sectionTitle}>Detalles de fabricación</Text>
                <DataTable headers={FAB_HEADERS} rows={data.fabrication_details.map(fabRowCells)} flexes={FAB_FLEXES} clean />
              </View>
            ) : null}
            {data.pools.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.sectionTitle}>Piletas</Text>
                <DataTable headers={POOL_HEADERS} rows={data.pools.map(poolRowCells)} flexes={POOL_FLEXES} />
              </View>
            ) : null}
            {data.additional_works && data.additional_works.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.sectionTitle}>Adicionales</Text>
                <DataTable
                  headers={ADDITIONAL_WORKS_HEADERS}
                  rows={data.additional_works.map(adicRowCells)}
                  flexes={ADDITIONAL_WORKS_FLEXES}
                  clean
                />
              </View>
            ) : null}
            {renderExtras(undefined)}
            {termsBlock}
            {footer}
          </Page>

          {/* Dedicated croquis page — only when there's something to show.
              Same fixed header + client + footer as the main page so the
              customer can extract just the croquis and still see who it's
              for. The page is rotated to landscape so the wide editor
              rectángulo has room to breathe. */}
          {data.sketch_images.length > 0 ? (
            <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
              <DocumentHeader data={data} />
              {clientGrid}
              <View style={styles.sketchBox}>
                <Text style={styles.sketchTitle}>Plano</Text>
                {data.sketch_images.map((img, i) => (
                  <Image key={img.slice(0, 32) || `sketch-${i}`} style={styles.sketchImgLarge} src={img} />
                ))}
              </View>
              {footer}
            </Page>
          ) : null}
        </Fragment>
      )}
    </Document>
  );
}
