/**
 * Style sheet — PAGE / HEADER / INFO-GRID / OBS domain.
 *
 * Extracted from `DocumentPdf.styles.ts` (which stays the public
 * orchestrator). The page frame, the fixed memberate (logo + company data +
 * document number) and the client info / observations blocks.
 */
import { StyleSheet } from '@react-pdf/renderer';
import {
  AFAMAR_RED,
  AMBER_200,
  AMBER_50,
  AMBER_700,
  FONT,
  GRAPHITE,
  HEADER_RED,
  SECONDARY_TEXT,
  SLATE_200,
  SLATE_500,
  SLATE_700,
  TEXT_DARK,
} from './DocumentPdf.styles.tokens';

export const pageStyles = StyleSheet.create({
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
});
