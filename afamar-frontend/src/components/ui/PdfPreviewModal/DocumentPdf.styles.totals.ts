/**
 * Style sheet — TOTALES / PAGO / TÉRMINOS / FIRMAS domain.
 *
 * Extracted from `DocumentPdf.styles.ts` (which stays the public
 * orchestrator). The two-column totals block, the blue TOTAL bar, the
 * payment-method block with its per-cuota table, the bank details, the
 * terms / payment-methods catalogue boxes, the signatures and the footer.
 */
import { StyleSheet } from '@react-pdf/renderer';
import {
  AFAMAR_RED,
  GRAPHITE,
  LIGHT_SURFACE,
  SLATE_200,
  SLATE_400,
  SLATE_50,
  SLATE_500,
  SLATE_700,
} from './DocumentPdf.styles.tokens';

export const totalStyles = StyleSheet.create({
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
});
