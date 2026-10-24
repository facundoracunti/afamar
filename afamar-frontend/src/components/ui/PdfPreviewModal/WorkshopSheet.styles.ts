/**
 * Styles of the "FICHA DE TALLER" (workshop sheet) PDF.
 *
 * Extracted verbatim from `WorkshopSheet.tsx` so the approved design (every
 * value, every color, every spacing) stays EXACTLY the same — only the
 * location of the StyleSheet changed.
 */
import { StyleSheet } from '@react-pdf/renderer';

const FONT = 'Helvetica';
const ACCENT = '#c0392b';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_200 = '#e2e8f0';
const SLATE_100 = '#f1f5f9';
const TEXT_DARK = '#1a1a1a';

export const styles = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    lineHeight: 1.4,
    color: TEXT_DARK,
    paddingTop: 10 * 2.83,
    paddingBottom: 10 * 2.83,
    paddingHorizontal: 10 * 2.83,
  },
  // ===== HEADER =====
  headerRow: { flexDirection: 'row', marginBottom: 3 },
  headerLeft: { width: '60%', flexDirection: 'row', alignItems: 'flex-start' },
  headerLeftLogo: { width: '28%' },
  headerLeftInfo: { width: '72%' },
  headerRight: { width: '40%', textAlign: 'right' },
  logo: { width: '86%', maxHeight: 62, objectFit: 'contain' },
  tagline: { fontSize: 10, fontWeight: 'bold', color: SLATE_700, lineHeight: 1.2, marginBottom: 2 },
  contactLine: { fontSize: 8, color: SLATE_700, lineHeight: 1.35 },
  docTitle: { fontSize: 11, fontWeight: 'bold', color: ACCENT, lineHeight: 1.2 },
  docNumber: { fontSize: 14, fontWeight: 'bold', color: ACCENT, fontFamily: 'Courier', marginTop: 1 },
  divider: { borderTop: `1px solid ${ACCENT}`, marginVertical: 3 },

  // ===== INFO ROW =====
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 1 },
  infoCell: { width: '50%', fontSize: 9, marginBottom: 2, paddingRight: 6 },
  infoLabel: { color: SLATE_500 },
  infoValue: { fontWeight: 'bold', color: '#0f172a' },

  // ===== PILETAS / MESADAS TABLE =====
  poolsBox: {
    marginTop: 2,
    marginBottom: 2,
    border: `1px solid ${SLATE_200}`,
    borderRadius: 3,
  },
  poolsHeader: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    backgroundColor: SLATE_100,
    borderBottom: `1px solid ${SLATE_200}`,
  },
  poolsHeaderModel: { flex: 1, fontSize: 7.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase', letterSpacing: 0.05 },
  poolsHeaderTarget: { width: '38%', fontSize: 7.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase', letterSpacing: 0.05, textAlign: 'right' },
  poolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottom: `1px solid ${SLATE_100}`,
  },
  poolModel: { flex: 1, fontSize: 9, fontWeight: 'bold', color: TEXT_DARK },
  poolTargetWrap: { width: '38%', alignItems: 'flex-end' },
  poolTarget: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: ACCENT,
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  poolGlobal: {
    fontSize: 8,
    color: SLATE_500,
    backgroundColor: SLATE_100,
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    fontStyle: 'italic',
  },
  poolsEmpty: { paddingHorizontal: 6, paddingVertical: 3, fontSize: 9, color: SLATE_500 },

  // ===== SKETCH =====
  sketchBox: {
    marginVertical: 4,
    padding: 5,
    border: `1px solid ${SLATE_200}`,
    backgroundColor: SLATE_100,
  },
  sketchTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.06,
    marginBottom: 3,
  },
  sketchImg: {
    width: '100%',
    objectFit: 'contain',
    backgroundColor: '#ffffff',
  },
  sketchPageCaption: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
    marginBottom: 1,
  },
  sketchPage: { marginBottom: 3 },
  sketchEmpty: {
    color: SLATE_500,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // ===== SPEC GRID + OBS (kept as an atomic block so it NEVER splits) =====
  specsBlock: {},
  specsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.06,
    marginTop: 5,
    marginBottom: 3,
  },
  specsGrid: { flexDirection: 'row', marginHorizontal: -3 },
  specCell: { width: '16.666%', alignItems: 'center' },
  specBox: {
    width: 62,
    minHeight: 50,
    border: `1px solid ${SLATE_200}`,
    borderRadius: 2,
  },
  specLabelRow: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: SLATE_100,
    borderBottom: `1px solid ${SLATE_200}`,
  },
  specLabel: { fontSize: 6, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase' },
  specValue: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 10,
    color: SLATE_500,
  },

  // ===== OBS =====
  obsBox: {
    marginTop: 5,
    border: `1px solid ${SLATE_200}`,
    height: 60,
  },
  obsTitleRow: {
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    backgroundColor: SLATE_100,
    borderBottom: `1px solid ${SLATE_200}`,
  },
  obsTitle: { fontSize: 7.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase' },
  obsBody: { padding: 4, fontSize: 8.5, color: TEXT_DARK },
});
