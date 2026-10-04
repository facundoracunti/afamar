/**
 * Style sheet + shared constants for the AFAMAR PDF document
 * (`DocumentPdf.tsx`). Extracted so the document definition stays a concise
 * orchestrator and every section component (`components/`) draws from the
 * same palette + layout tokens.
 */
import { StyleSheet } from '@react-pdf/renderer';
import { SKETCH_STAGE_WIDTH, SKETCH_STAGE_HEIGHT } from '../../../constants';

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
const TEXT_DARK = '#1a1a1a';

export const styles = StyleSheet.create({
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
  // Section header band emitted by the comparativa to group rows by piece
  // (e.g. "COCINA" / "PARRILLA"). Spans the full table width, slate-700
  // uppercase, so the reader sees the per-piece grouping even when the
  // document has many small pieces.
  tableSectionHeader: {
    flexDirection: 'row',
    backgroundColor: SLATE_700,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  tableSectionHeaderText: { color: '#fff', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
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
  // Totals rows stay on a single row (`wrap: false` prevents react-pdf
  // from splitting the label/value pair across pages). The label keeps
  // 70% of the right column so large ARS values can sit on a single
  // line in the 30% value cell — overflow only happens for very large
  // totals (>10-digit ARS) and that's the "speak to your accountant"
  // limit rather than a layout bug.
  totalsRow: { flexDirection: 'row', paddingVertical: 2, wrap: false },
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
  // ===== GRAND TOTAL (the blue bar) =====
  // Column layout: the "TOTAL" label sits on top and the dual-currency
  // value stack goes below it, fully contained inside the right column.
  // `wrap: false` on the parent keeps the blue bar intact — react-pdf
  // will move the whole row to the next page instead of splitting the
  // label from its value (or ARS from USD).
  grand: {
    backgroundColor: BLUE_700,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
    wrap: false,
  },
  grandLbl: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 3,
  },
  // Value column: ARS bold large on top, USD smaller just below. Right-
  // aligned to match the rest of the totals rows above.
  grandValWrap: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  grandValArs: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'right',
  },
  grandValUsd: {
    color: '#fff',
    fontSize: 9,
    textAlign: 'right',
    opacity: 0.85,
    marginTop: 1,
  },
  // Legacy aliases intentionally removed: every caller now uses the
  // grandValWrap + grandValArs / grandValUsd column stack (clean dual-
  // currency rendering without overflow).
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