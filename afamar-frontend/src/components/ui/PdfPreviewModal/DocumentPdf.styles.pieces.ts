/**
 * Style sheet — PIEZA / CROQUIS / TABLA domain.
 *
 * Extracted from `DocumentPdf.styles.ts` (which stays the public
 * orchestrator). The piece card frame, the croquis block, the section title
 * and the data-table primitives (head / row / cells) used by every block.
 */
import { StyleSheet } from '@react-pdf/renderer';
import {
  ACCENT,
  GRAPHITE,
  LIGHT_SURFACE,
  SLATE_200,
  SLATE_50,
  SLATE_500,
  SLATE_700,
  SOFT_BORDER,
  SKETCH_PDF_HEIGHT,
  SKETCH_PDF_LARGE_HEIGHT,
  SKETCH_PDF_LARGE_WIDTH,
  SKETCH_PDF_WIDTH,
} from './DocumentPdf.styles.tokens';

export const pieceStyles = StyleSheet.create({
  // Piece cards use a slightly tighter outer rhythm so a compact option can
  // keep its complete total card on the same A4 page. Internal card spacing,
  // table rows, typography and borders remain unchanged.
  pieceBlock: { marginTop: 2, marginBottom: 2 },
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
  emptyRow: { fontSize: 8, color: SLATE_500, fontStyle: 'italic', paddingVertical: 4 },
});
