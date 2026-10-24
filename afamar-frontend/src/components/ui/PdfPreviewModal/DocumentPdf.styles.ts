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
const ACCENT = '#B6403A';
const HEADER_RED = '#B6403A';
const SLATE_700 = '#334155';
const SLATE_600 = '#475569';
const SLATE_900 = '#0f172a';
const SLATE_800 = '#1e293b';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const SLATE_300 = '#cbd5e1';
const SLATE_200 = '#e2e8f0';
const SLATE_100 = '#f1f5f9';
const AFAMAR_RED = '#B6403A';
const GRAPHITE = '#252B33';
const SECONDARY_TEXT = '#69717C';
const LIGHT_SURFACE = '#F4F5F6';
const SOFT_BORDER = '#E5E7EB';
const SLATE_50 = '#f8fafc';
const AMBER_700 = '#92400e';
const AMBER_200 = '#fde68a';
const AMBER_50 = '#fffbeb';
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
  // Logo container — capped at 161px (ceiling 170) so the AFAMAR mark
  // never stretches past ~35% of the column even on a wide logo (2026-09-25
  // mañana). The previous `width: '100%'` made it consume every pixel the
  // column had, so the tagline underneath looked crammed.
  headerLeftLogo: { width: 161, maxWidth: 170, alignItems: 'flex-start' },
  headerLeftInfo: { width: '100%', marginTop: 7 },
  headerRight: { width: '35%', textAlign: 'right' },
  // Logo image itself: width 161 (matches the container), height auto
  // preserves the source aspect ratio. `objectFit` is dropped because
  // the image now has natural dimensions.
  logo: { width: 161, height: 'auto', maxHeight: 81, marginBottom: 0 },
  companyName: { fontSize: 11, fontWeight: 'bold', color: GRAPHITE, lineHeight: 1.2, marginBottom: 1 },
  tagline: { fontSize: 9, fontWeight: 'bold', color: SECONDARY_TEXT, lineHeight: 1.2, marginBottom: 2 },
  trajectory: { fontSize: 7.5, color: SECONDARY_TEXT, lineHeight: 1.2, marginBottom: 2 },
  contactLine: { fontSize: 8, color: SLATE_700, lineHeight: 1.4 },
  docTitle: { fontSize: 13, fontWeight: 'bold', color: HEADER_RED, lineHeight: 1.2, marginTop: 4 },
  docNumber: { fontSize: 18, fontWeight: 'bold', color: HEADER_RED, fontFamily: 'Courier', marginTop: 2 },
  docSub: { fontSize: 8, color: SLATE_500, marginTop: 2 },
  // Validity line ("Presupuesto válido por X días") — marginTop bumped to
  // 8 so the line breathes below the document number (the previous 2 made
  // "P-XXXXXX" and the validity text visually collide).
  validityText: { fontSize: 8.5, fontWeight: 'bold', color: '#92400e', marginTop: 8, textAlign: 'right' },
  divider: { borderTop: `1px solid ${AFAMAR_RED}`, marginBottom: 5 },
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
  optSectionBlock: { marginTop: 5, marginBottom: 5, padding: 7, border: `1px solid ${SOFT_BORDER}`, borderRadius: 4, backgroundColor: '#FFFFFF' },
  optSectionBlockMain: { borderColor: SOFT_BORDER, backgroundColor: '#FFFFFF' },
  optSectionBlockAlt: { borderColor: SLATE_400, backgroundColor: SLATE_50 },
  optSectionTitle: { fontSize: 10, fontWeight: 'bold', color: GRAPHITE, textTransform: 'uppercase', marginBottom: 5, paddingLeft: 6, paddingBottom: 2, borderLeft: `3px solid ${AFAMAR_RED}` },
  optSectionTitleAlt: { color: SLATE_700, borderBottomColor: SLATE_400 },
  optSectionSubtotal: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', marginTop: 6, paddingVertical: 5, paddingHorizontal: 6, backgroundColor: LIGHT_SURFACE, borderRadius: 3 },
  optSectionSubtotalLbl: { fontSize: 8, fontWeight: 'bold', color: GRAPHITE, marginRight: 8 },
  optSectionSubtotalVal: { fontSize: 10, fontWeight: 'bold', color: GRAPHITE },
  optSectionSubtotalUsd: { fontSize: 7.5, color: SECONDARY_TEXT, marginLeft: 6 },
  pieceSubsectionLabel: { fontSize: 7.5, fontWeight: 'bold', color: SECONDARY_TEXT, textTransform: 'uppercase', letterSpacing: 0.25, marginBottom: 2 },
  // Consolidated TOTAL GENERAL ALTERNATIVO card (end of the HOJA DE
  // ALTERNATIVAS) — one compact 3-line card per alternative material
  // (2026-10-01 cont.7): [name + pieces] / [Subtotal] / [TOTAL bar].
  // Deliberately tight paddings: N alternatives must fit on one page
  // instead of each eating a full block.
  altTotalCard: {
    marginTop: 3,
    marginBottom: 3,
    paddingVertical: 4,
    paddingHorizontal: 5,
    border: `1px solid ${SLATE_200}`,
    borderLeft: `3px solid ${AFAMAR_RED}`,
    borderRadius: 3,
  },
  altTotalHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  altTotalName: { fontSize: 9, fontWeight: 'bold', color: SLATE_700 },
  altTotalPieces: { fontSize: 6.5, color: SLATE_500 },
  altTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  altTotalLbl: { fontSize: 7.5, color: SLATE_500 },
  optAdicionalBreakdown: { fontSize: 7, color: SLATE_500, fontStyle: 'italic', marginTop: 1 },
  altTotalVal: { fontSize: 8, fontWeight: 'bold', color: SLATE_700 },
  altTotalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GRAPHITE,
    borderLeft: `3px solid ${AFAMAR_RED}`,
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginTop: 2,
    borderRadius: 2,
  },
  altTotalBarLbl: { fontSize: 7.5, fontWeight: 'bold', color: '#fff' },
  altTotalBarVal: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  optionTotalBarValue: { alignItems: 'flex-end' },
  optionTotalBarArs: { fontSize: 11, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  optionTotalBarUsd: { fontSize: 7.5, color: '#fff', opacity: 0.82, marginTop: 1, textAlign: 'right' },
  // ===== RESUMEN COMPARATIVO DE OPCIONES (B1) =====
  // One compact row per independent option: name + badge on the first
  // line, pieces/materiales/sink summary on a muted second line, and the
  // dual-currency total right-aligned. Deliberately tight so N options
  // fit on a single sheet.
  optRow: {
    marginTop: 3,
    marginBottom: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    border: `1px solid ${SLATE_200}`,
    borderRadius: 3,
  },
  optRowWinner: {
    borderColor: AFAMAR_RED,
    backgroundColor: LIGHT_SURFACE,
  },
  optRowCheapest: {
    borderColor: SLATE_400,
    backgroundColor: '#f8fafc',
  },
  optRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optRowName: { fontSize: 9.5, fontWeight: 'bold', color: SLATE_700 },
  optRowBadge: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: AFAMAR_RED,
    paddingVertical: 1,
    paddingHorizontal: 3,
    borderRadius: 2,
  },
  optRowBadgeMuted: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: SLATE_500,
    paddingVertical: 1,
    paddingHorizontal: 3,
  },
  optRowMeta: { fontSize: 6.5, color: SLATE_500, marginTop: 1 },
  optRowTotal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  optRowTotalArs: { fontSize: 10, fontWeight: 'bold', color: HEADER_RED },
  optRowTotalUsd: { fontSize: 7.5, color: SECONDARY_TEXT, marginLeft: 5 },
  optRowFootnote: {
    fontSize: 6.5,
    color: SLATE_500,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // ===== COMPARATIVA DE OPCIONES — PORTADA (2026-10-01) =====
  // The first page of a multi-option budget used to look empty: a thin
  // list of prices on a white sheet. It now reads as a commercial cover:
  // roomy option cards with a strong price hierarchy, the pileta each
  // variant includes, and a closing block with the commercial conditions.

  /** Option card — roomy, with a defined border. */
  optCard: {
    marginTop: 3,
    marginBottom: 3,
    paddingVertical: 7,
    paddingHorizontal: 8,
    border: `1px solid ${SLATE_300}`,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  /** The cheapest option gets the accent border + tint. */
  optCardCheapest: {
    borderColor: HEADER_RED,
    borderWidth: 1.5,
    backgroundColor: '#fff7f5',
  },
  /** Rank badge (1, 2, 3…) shown on the left of the option name. */
  optCardRank: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: SLATE_700,
    width: 13,
    height: 13,
    textAlign: 'center',
    paddingTop: 2,
    borderRadius: 7,
    marginRight: 5,
  },
  optCardRankCheapest: { backgroundColor: HEADER_RED },
  optCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optCardNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
  },
  optCardName: { fontSize: 12.5, fontWeight: 'bold', color: SLATE_900 },
  optCardBadge: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: HEADER_RED,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  optCardBadgeMuted: {
    fontSize: 7,
    fontWeight: 'bold',
    color: SLATE_600,
    backgroundColor: SLATE_100,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  optCardMeta: { fontSize: 7.5, color: SLATE_600, marginTop: 3, lineHeight: 1.2 },
  /** The pileta (bacha) the option includes — a discreet highlighted row. */
  optCardPool: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 5,
    backgroundColor: SLATE_50,
    borderRadius: 2,
  },
  optCardPoolLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginRight: 5,
  },
  optCardPoolValue: { fontSize: 7.5, fontWeight: 'bold', color: SLATE_700 },
  /** Price block — right aligned, big ARS + smaller USD below. */
   optCardPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 6,
    marginHorizontal: -8,
    marginBottom: -6,
     paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: GRAPHITE,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  optCardPriceLabel: {
    fontSize: 6.5,
    color: '#FFFFFF',
    opacity: 0.78,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  optCardPriceArs: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'right' },
   optCardPriceUsd: { fontSize: 8, color: '#FFFFFF', opacity: 0.78, marginTop: 5, textAlign: 'right' },

  /** Closing block with the commercial conditions. */
  optFooterBox: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
    border: `1px solid ${SLATE_200}`,
    borderRadius: 4,
  },
  optFooterTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: SLATE_800,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  optFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  optFooterBullet: {
    fontSize: 7.5,
    color: SLATE_600,
    width: 10,
  },
  optFooterText: {
    fontSize: 7.5,
    color: SLATE_600,
    flexGrow: 1,
    lineHeight: 1.35,
  },
  comparisonTitle: {
    marginTop: 5,
    marginBottom: 5,
    paddingLeft: 7,
    paddingVertical: 2,
    borderLeft: `3px solid ${AFAMAR_RED}`,
  },
  comparisonTitleText: { fontSize: 10, fontWeight: 'bold', color: GRAPHITE, textTransform: 'uppercase' },
  optionPageTitle: {
    marginTop: 5,
    marginBottom: 5,
    paddingVertical: 4,
    paddingHorizontal: 7,
    backgroundColor: LIGHT_SURFACE,
    borderLeft: `3px solid ${AFAMAR_RED}`,
    borderRadius: 2,
  },
  optionPageTitleText: { fontSize: 10.5, fontWeight: 'bold', color: GRAPHITE, textTransform: 'uppercase' },
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
  tableHead: { flexDirection: 'row', backgroundColor: LIGHT_SURFACE, borderBottom: `1px solid ${SOFT_BORDER}` },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${SOFT_BORDER}` },
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
  cell: { paddingVertical: 4, paddingHorizontal: 5 },
  cellLast: { paddingVertical: 4, paddingHorizontal: 5 },
  thText: { fontSize: 6.5, fontWeight: 'bold', color: GRAPHITE },
  thTextNum: { fontSize: 6.5, fontWeight: 'bold', color: GRAPHITE, textAlign: 'right' },
  tdText: { fontSize: 7.5, color: GRAPHITE },
  tdTextNum: { fontSize: 7.2, textAlign: 'right', color: GRAPHITE },
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
  totalsUsdRate: { fontSize: 11, fontWeight: 'bold', color: GRAPHITE },
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
    backgroundColor: GRAPHITE,
    borderLeft: `3px solid ${AFAMAR_RED}`,
    paddingVertical: 6,
    paddingHorizontal: 7,
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
     backgroundColor: LIGHT_SURFACE,
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
  termsBox: { marginTop: 6, backgroundColor: SLATE_50, border: `1px solid ${SLATE_200}`, borderLeft: `3px solid ${AFAMAR_RED}`, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6 },
  termsTitle: { fontSize: 6.5, fontWeight: 'bold', color: GRAPHITE, textTransform: 'uppercase', lineHeight: 1.1 },
  termsText: { fontSize: 6, lineHeight: 1.05 },
  termsListItem: { fontSize: 6, lineHeight: 1.05 },
  // ===== PAYMENT METHODS CATALOGUE (reference box) =====
  // Lists the active payment methods from /admin/configuration/payment-methods
  // so the customer sees every way they can pay. Renders next to the
  // delivery-conditions column in `termsRow` (right side, same row).
  paymentMethodsBox: { flex: 1, marginTop: 6, backgroundColor: SLATE_50, border: `1px solid ${SLATE_200}`, borderLeft: `3px solid ${AFAMAR_RED}`, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6 },
  paymentMethodsItem: { fontSize: 6.5, lineHeight: 1.3 },
  // ===== SIGNATURES =====
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  signatureCell: { width: '38%', textAlign: 'center' },
  signatureLine: { borderTopWidth: 0.75, borderTopColor: GRAPHITE, height: 1 },
  signatureCaption: { fontSize: 5.5, color: SLATE_500, lineHeight: 1.1 },
  // ===== FOOTER =====
  footer: { position: 'absolute', bottom: 2 * 2.83, left: 12 * 2.83, right: 12 * 2.83, textAlign: 'center', fontSize: 5, color: SLATE_500, lineHeight: 1 },
  emptyRow: { fontSize: 8, color: SLATE_500, fontStyle: 'italic', paddingVertical: 4 },
});
