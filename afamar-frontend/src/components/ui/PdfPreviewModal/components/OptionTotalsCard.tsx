import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { OptionTotal } from '../../../../utils/pdf/buildPdfData';
import { fmt } from '../DocumentPdf.utils';
import { styles } from '../DocumentPdf.styles';

/**
 * TOTAL DE UNA OPCIÓN — the closing card of an option's page.
 *
 * Same visual language as the alternative cards (`altTotal*` styles) so
 * the document reads as one system:
 *
 *   1. `<NOMBRE DE LA OPCIÓN>` + the pieces it covers (small, muted).
 *   2. `Subtotal` — the option's own job subtotal (materials + zócalos +
 *      frentes + additional works + piletas).
 *   3. `Descuento` / `Interés` — only when they apply.
 *   4. `TOTAL DE LA OPCIÓN` — the blue bar with the ARS amount and the
 *      USD equivalent.
 *
 * The amounts come from the option's OWN subtotal, so the number printed
 * here is exactly the number the operator sees on that option's tab in
 * the form (both read `computeOptionSubtotal`).
 *
 * COMMERCIAL DOCUMENT ONLY: no internal control vocabulary (no "ganadora",
 * no "se convierte en Orden de Trabajo", no stock talk).
 */
export function OptionTotalsCard({ option }: { option: OptionTotal }) {
  const piecesLabel = option.piece_names.length > 0 ? option.piece_names.join(', ') : '—';
  return (
    <View style={styles.altTotalCard} wrap={false}>
      <View style={styles.altTotalHead}>
        <Text style={styles.altTotalName}>{option.name}</Text>
        <Text style={styles.altTotalPieces}>{`Piezas: ${piecesLabel}`}</Text>
      </View>

      <View style={styles.altTotalRow}>
        <Text style={styles.altTotalLbl}>Subtotal</Text>
        <Text style={styles.altTotalVal}>{`$ ${fmt(option.subtotal_ars)}`}</Text>
      </View>

      {option.discount_fixed_amount > 0 ? (
        <View style={styles.altTotalRow}>
          <Text style={styles.altTotalLbl}>Descuento</Text>
          <Text style={styles.altTotalVal}>{`-$ ${fmt(option.discount_fixed_amount)}`}</Text>
        </View>
      ) : null}

      {option.surcharge_amount > 0 ? (
        <View style={styles.altTotalRow}>
          <Text style={styles.altTotalLbl}>Interés</Text>
          <Text style={styles.altTotalVal}>{`$ ${fmt(option.surcharge_amount)}`}</Text>
        </View>
      ) : null}

      <View style={styles.altTotalBar}>
        <Text style={styles.altTotalBarLbl}>TOTAL DE LA OPCIÓN</Text>
        <View style={styles.optionTotalBarValue}>
          <Text style={styles.optionTotalBarArs}>{`$ ${fmt(option.total_ars)}`}</Text>
          {option.total_usd > 0 ? (
            <Text style={styles.optionTotalBarUsd}>{`USD $ ${fmt(option.total_usd)}`}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default OptionTotalsCard;
