import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { PieceAlternativeTotal } from '../../../../utils/pdf/buildPdfData';
import { formatUsdFetchedAt, fmt } from '../DocumentPdf.utils';
import { styles } from '../DocumentPdf.styles';

/**
 * TOTAL GENERAL ALTERNATIVO — highlighted summary blocks shown at the end of
 * the HOJA DE ALTERNATIVAS, ONE per alternative material CONSOLIDATED across
 * every piece that quotes it. Each block re-runs the document total rule set
 * (traslado + descuento comercial + recargo + seña) over the aggregated
 * alternative subtotals, so the customer sees the real final price of
 * choosing that material for the whole job, in both currencies.
 */
export function AlternativeTotalsSummary({
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