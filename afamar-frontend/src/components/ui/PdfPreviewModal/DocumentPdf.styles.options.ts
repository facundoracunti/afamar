/**
 * Style sheet — OPCIONES / ALTERNATIVAS domain.
 *
 * Extracted from `DocumentPdf.styles.ts` (which stays the public
 * orchestrator). The per-option breakdown cards and the consolidated
 * "TOTAL GENERAL ALTERNATIVO" cards.
 */
import { StyleSheet } from '@react-pdf/renderer';
import {
  AFAMAR_RED,
  GRAPHITE,
  LIGHT_SURFACE,
  SECONDARY_TEXT,
  SLATE_200,
  SLATE_400,
  SLATE_50,
  SLATE_500,
  SLATE_700,
  SOFT_BORDER,
} from './DocumentPdf.styles.tokens';

export const optionStyles = StyleSheet.create({
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
});
