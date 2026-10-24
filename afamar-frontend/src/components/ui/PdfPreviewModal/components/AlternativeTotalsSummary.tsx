import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { PieceAlternativeTotal } from '../../../../utils/pdf/buildPdfData';
import { fmt } from '../DocumentPdf.utils';
import { styles } from '../DocumentPdf.styles';

/**
 * TOTAL GENERAL ALTERNATIVO — one compact card per alternative material at
 * the end of the HOJA DE ALTERNATIVAS.
 *
 * **Compact 3-line card (2026-10-01 cont.7).** The previous layout reused
 * the full document totals block (two-column "Dólar del día" + 6 stacked
 * rows + the grand bar), so N alternatives ate a whole page. This version
 * prints exactly three lines per option:
 *
 *   1. `<NOMBRE DE LA ALTERNATIVA>` + the pieces it covers (small, muted).
 *   2. `Subtotal` — the combined job subtotal (alternative pieces + fixed
 *      base pieces), right-aligned.
 *   3. `TOTAL GRAL ALTERNATIVO` — the blue bar, ARS bold with the USD
 *      equivalent inlined on the same line.
 *
 * Dropped as redundant: the "Dólar del día" column (the rate is already in
 * the document header on page 1), the `Piezas fijas (base): — ninguna`
 * line (meaningless when there are none), and the per-component
 * subtotal breakdown (alt / pool / fixed / subtotal) — the customer only
 * needs the job total per variant, and the per-piece detail already lives
 * in `AlternativesSheet` above.
 */
export function AlternativeTotalsSummary({
  totals,
  showSaldo,
}: {
  totals: PieceAlternativeTotal[];
  showSaldo: boolean;
}) {
  if (!totals || totals.length === 0) return null;
  return (
    <>
      {totals.map((t) => {
        const piecesLabel = t.pieces.length > 0 ? t.pieces.join(', ') : '—';
        return (
          <View key={t.material_name} style={styles.altTotalCard} wrap={false}>
            {/* 1 — variant name + the pieces it covers. */}
            <View style={styles.altTotalHead}>
              <Text style={styles.altTotalName}>{t.material_name}</Text>
              <Text style={styles.altTotalPieces}>{`Piezas: ${piecesLabel}`}</Text>
            </View>

            {/* 2 — combined job subtotal. */}
            <View style={styles.altTotalRow}>
              <Text style={styles.altTotalLbl}>Subtotal</Text>
              <Text style={styles.altTotalVal}>{`$ ${fmt(t.subtotal_ars)}`}</Text>
            </View>

            {/* 3 — the blue TOTAL bar, dual currency on a single line. */}
            <View style={styles.altTotalBar}>
              <Text style={styles.altTotalBarLbl}>TOTAL GRAL ALTERNATIVO</Text>
              <Text style={styles.altTotalBarVal}>
                {`$${fmt(t.total_ars)}`}
                {t.total_usd > 0 ? `  (USD $${fmt(t.total_usd)})` : ''}
              </Text>
            </View>

            {showSaldo && t.balance_due > 0 ? (
              <View style={styles.altTotalRow} wrap={false}>
                <Text style={styles.altTotalLbl}>Saldo pendiente</Text>
                <Text style={styles.altTotalVal}>{`$ ${fmt(t.balance_due)}`}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );
}