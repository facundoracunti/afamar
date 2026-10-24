/**
 * Style sheet — PORTADA COMERCIAL / COMPARATIVA DE OPCIONES domain.
 *
 * Extracted from `DocumentPdf.styles.ts` (which stays the public
 * orchestrator). The compact "Resumen Comparativo de Opciones" rows, the
 * commercial cover cards of the multi-option budget and the closing block
 * with the commercial conditions.
 */
import { StyleSheet } from '@react-pdf/renderer';
import {
  AFAMAR_RED,
  GRAPHITE,
  HEADER_RED,
  LIGHT_SURFACE,
  SECONDARY_TEXT,
  SLATE_100,
  SLATE_200,
  SLATE_300,
  SLATE_400,
  SLATE_50,
  SLATE_500,
  SLATE_600,
  SLATE_700,
  SLATE_800,
  SLATE_900,
} from './DocumentPdf.styles.tokens';

export const coverStyles = StyleSheet.create({
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
});
