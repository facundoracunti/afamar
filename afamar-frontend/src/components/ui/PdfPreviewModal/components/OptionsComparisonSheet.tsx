import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { OptionTotal, PdfDocumentData } from '../../../../utils/pdf/buildPdfData';
import { formatUsdFetchedAt, fmt } from '../DocumentPdf.utils';
import { styles } from '../DocumentPdf.styles';

/**
 * COMPARATIVA DE OPCIONES — the COVER page of a multi-option budget.
 *
 * It reads as a commercial cover, not as an internal control sheet:
 *
 *   1. One roomy card per option, ORDERED CHEAPEST FIRST, with a rank
 *      badge, the materials it covers, the pileta (bacha) it includes and
 *      its final price (big ARS + USD below). The cheapest carries the
 *      "MÁS ECONÓMICA" badge.
 *   2. A closing block with the commercial conditions that are NOT
 *      printed anywhere else on the page: the offer's validity and the
 *      reference exchange rate.
 *
 * The order (ascending by final price) is applied HERE as well as in the
 * data builder, so the cover and the per-option detail pages always show
 * the same progression.
 *
 * COMMERCIAL DOCUMENT ONLY: no internal control vocabulary (no "opción
 * ganadora", no "se convierte en Orden de Trabajo", no stock talk).
 */
export function OptionsComparisonSheet({
  totals,
}: {
  totals: OptionTotal[];
}) {
  if (!totals || totals.length < 2) return null;

  // Cheapest first — the customer opens the document on the most
  // affordable variant and closes it on the priciest.
  const ordered = [...totals].sort((a, b) =>
    a.total_ars === b.total_ars ? 0 : a.total_ars - b.total_ars,
  );
  const cheapestId = ordered[0].id;

  return (
    <View>
      <View style={styles.comparisonTitle}>
        <Text style={styles.comparisonTitleText}>Comparativa de opciones</Text>
      </View>

      {/* ── Una tarjeta por opción (de menor a mayor precio) ─────────── */}
      {ordered.map((t, index) => {
        const isCheapest = t.id === cheapestId;
        const cardStyle = [
          styles.optCard,
          isCheapest ? styles.optCardCheapest : undefined,
        ].filter(Boolean) as never;
        const rankStyle = [
          styles.optCardRank,
          isCheapest ? styles.optCardRankCheapest : undefined,
        ].filter(Boolean) as never;
        return (
          <View key={t.id} style={cardStyle} wrap={false}>
            <View style={styles.optCardHead}>
              <View style={styles.optCardNameWrap}>
                <Text style={rankStyle}>{String(index + 1)}</Text>
                <Text style={styles.optCardName}>{t.name}</Text>
              </View>
              {isCheapest ? (
                <Text style={styles.optCardBadge}>MÁS ECONÓMICA</Text>
              ) : (
                <Text style={styles.optCardBadgeMuted}>
                  {`OPCIÓN ${index + 1}`}
                </Text>
              )}
            </View>

            <Text style={styles.optCardMeta}>
              {[
                t.material_names.length > 0
                  ? `Materiales: ${t.material_names.join(', ')}`
                  : '',
                t.total_m2 > 0 ? `${fmt(t.total_m2)} m²` : '',
              ]
                .filter(Boolean)
                .join('   ·   ')}
            </Text>

            {/* The pileta (bacha) THIS option includes — the customer must
                know exactly which sink each variant comes with. */}
            {t.pool_models.length > 0 ? (
              <View style={styles.optCardPool}>
                <Text style={styles.optCardPoolLabel}>Pileta</Text>
                <Text style={styles.optCardPoolValue}>
                  {t.pool_models.join('  ·  ')}
                </Text>
              </View>
            ) : null}

            <View style={styles.optCardPriceRow}>
              <Text style={styles.optCardPriceLabel}>PRECIO FINAL</Text>
              <View>
                <Text style={styles.optCardPriceArs}>{`$ ${fmt(t.total_ars)}`}</Text>
                {t.total_usd > 0 ? (
                  <Text style={styles.optCardPriceUsd}>
                    {`USD $ ${fmt(t.total_usd)}`}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}

      {/* ── Condiciones comerciales ────────────────────────────────────
          Rendered by the parent (DocumentPdf) at the BOTTOM of the page,
          right before the signatures — see `CommercialFooter`. */}
      <Text style={styles.optRowFootnote}>
        Cada opción se detalla en las páginas siguientes, con sus piezas,
        materiales, medidas, trabajos adicionales y piletas.
      </Text>
    </View>
  );
}

/** Closing block: the commercial conditions that are NOT printed
 *  anywhere else on the page (the payment modalities live in the
 *  document's own "Método de pago" box — printing them twice was the
 *  duplicated block the customer saw).
 *
 *  Rendered once, at the foot of the comparison page, after the terms. */
export function CommercialFooter({ data }: { data?: PdfDocumentData }) {
  if (!data) return null;
  const validity = data.company.budget_validity_text || '';
  const rate = data.usd_rate > 0 ? data.usd_rate : 0;
  const fetchedAt = data.usd_rate_fetched_at
    ? formatUsdFetchedAt(data.usd_rate_fetched_at)
    : '';
  const rows: string[] = [];
  if (validity) rows.push(`Validez de la oferta: ${validity}`);
  if (rate > 0) {
    rows.push(
      `Cotización de referencia: 1 USD = $ ${fmt(rate)}${
        fetchedAt ? ` (${fetchedAt})` : ''
      }. Los valores en dólares se ajustan a la cotización del día de pago.`,
    );
  }
  if (rows.length === 0) return null;
  return (
    <View style={styles.optFooterBox} wrap={false}>
      <Text style={styles.optFooterTitle}>Condiciones comerciales</Text>
      {rows.map((r) => (
        <View key={r} style={styles.optFooterRow}>
          <Text style={styles.optFooterBullet}>•</Text>
          <Text style={styles.optFooterText}>{r}</Text>
        </View>
      ))}
    </View>
  );
}

export default OptionsComparisonSheet;
