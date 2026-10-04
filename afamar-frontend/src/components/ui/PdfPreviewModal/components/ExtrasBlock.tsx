import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { MaterialSection, PdfDocumentData } from '../../../../utils/pdf/buildPdfData';
import { BANK_INFO, PAYMENT_METHOD_TRANSFER } from '../../../../constants';
import { formatUsdFetchedAt, fmt } from '../DocumentPdf.utils';
import { styles } from '../DocumentPdf.styles';
import { DataTable, ObsBox } from './Atoms';
import {
  COMPARISON_FLEXES,
  COMPARISON_HEADERS,
  comparisonRowsWithTotal,
  comparisonSectionHeaderFlags,
} from './TableRows';

/**
 * Document-level totals + payment + signatures + observations + comparison.
 * Normally rendered only on the principal page (where the customer signs the
 * chosen option). When the budget has NO principal material, every
 * alternative is a standalone quote, so this block is rendered on EACH
 * alternative using that option's OWN totals (`section.total_ars` etc.,
 * computed in buildPdfData) so all of them show their correct final price
 * regardless of how many alternatives there are.
 *
 * `section` is the per-section override (only used where an alternative
 * carries its own totals); the rest of the rows always read the
 * document-level fields.
 */
export function ExtrasBlock({
  data,
  section,
}: {
  data: PdfDocumentData;
  section?: Partial<MaterialSection> | null;
}) {
  // "Saldo pendiente" only makes sense when payments were actually
  // registered against this document: a work order always tracks payments,
  // a budget only when a seña was received. Without that, the row would just
  // repeat the TOTAL and mislead the customer.
  const showSaldo =
    data.document_type === 'work_order' ||
    data.deposit_received > 0 ||
    data.deposit_usd > 0;

  return (
    <>
      {/* COMPARATIVA DE MEDICIÓN — work orders only, per-order flag; the
          `measurement_comparison` array is empty when disabled */}
      {data.document_type === 'work_order' && data.measurement_comparison.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.sectionTitle}>Comparativa de medición</Text>
          <DataTable
            headers={COMPARISON_HEADERS}
            rows={comparisonRowsWithTotal(data.measurement_comparison)}
            flexes={COMPARISON_FLEXES}
            sectionHeaderFlags={comparisonSectionHeaderFlags(data.measurement_comparison)}
          />
        </View>
      ) : null}

      {/* OBSERVATIONS — only on principal page */}
      {data.notes ? (
        <ObsBox title="Observaciones">
          <Text style={styles.obsText}>{data.notes}</Text>
        </ObsBox>
      ) : null}
      {data.important_observations ? (
        <ObsBox title="Observaciones importantes">
          {data.important_observations_list.length > 0 ? (
            data.important_observations_list.map((t) => (
              <Text key={t} style={styles.obsListItem}>{`• ${t}`}</Text>
            ))
          ) : (
            <Text style={styles.obsText}>{data.important_observations}</Text>
          )}
        </ObsBox>
      ) : null}

      {/* TOTALS — two-column layout (2026-09-25 tarde):
          LEFT  ~32% → Dólar del día (label / fecha+hora / cotización)
          RIGHT ~68% → Subtotal → Traslado → Descuento → Cat. Descuento
                       → Interés → Tabla de cuotas → TOTAL (barra azul)
                       → Seña / Pagos Registrados → Saldo pendiente
          The strict sequence SUBTOTAL → DESCUENTO → TOTAL → SALDO is
          preserved (Interés/Traslado/Cat-Desc/Cuotas are intermediate
          rows that don't break the user-facing hierarchy). */}
      <View style={styles.totalsLayout}>
        <View style={styles.totalsLayoutLeft}>
          <Text style={styles.totalsUsdLabel}>Dólar del día</Text>
          {data.usd_rate_fetched_at ? (
            <Text style={styles.totalsUsdDate}>
              {formatUsdFetchedAt(data.usd_rate_fetched_at)}
            </Text>
          ) : null}
          <Text style={styles.totalsUsdRate}>
            {`$ ${data.usd_rate > 0 ? fmt(data.usd_rate) : '—'}`}
          </Text>
        </View>

        <View style={styles.totalsLayoutRight}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLbl}>Subtotal</Text>
            <Text style={styles.totalsVal}>{`$ ${fmt(section?.subtotal_ars ?? data.subtotal)}`}</Text>
          </View>
          {data.transport > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>Traslado</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(data.transport)}`}</Text>
            </View>
          ) : null}
          {data.discount_fixed_amount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>
                {data.discount_percentage > 0
                  ? `Descuento (${data.discount_percentage}%)`
                  : 'Descuento'}
              </Text>
              <Text style={styles.totalsVal}>{`-$ ${fmt(section?.discount_fixed_amount ?? data.discount_fixed_amount)}`}</Text>
            </View>
          ) : null}
          {data.catalogue_discount_amount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>
                {`Descuento (${data.catalogue_discount_percentage}%) ${data.catalogue_method_label}`.trim()}
              </Text>
              <Text style={styles.totalsVal}>{`-$ ${fmt(data.catalogue_discount_amount)}`}</Text>
            </View>
          ) : null}
          {(section?.surcharge_percentage ?? data.surcharge_percentage) > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>Interés:</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(section?.surcharge_amount ?? data.surcharge_amount)}`}</Text>
            </View>
          ) : null}
          {(section?.catalogue_installment_detail ?? data.catalogue_installment_detail) && (section?.catalogue_installment_detail ?? data.catalogue_installment_detail).length > 1 ? (
            <View style={styles.installmentTable}>
              <View style={styles.installmentHeader}>
                <Text style={[styles.installmentHeaderCell, styles.installmentHeaderN]}>Cuota #</Text>
                <Text style={[styles.installmentHeaderCell, styles.installmentHeaderPct]}>Interés</Text>
                <Text style={[styles.installmentHeaderCell, styles.installmentHeaderAmount]}>Monto</Text>
              </View>
              {(section?.catalogue_installment_detail ?? data.catalogue_installment_detail).map((row) => (
                <View key={row.cuota} style={styles.installmentRow}>
                  <Text style={[styles.installmentCell, styles.installmentHeaderN]}>{row.cuota}</Text>
                  <Text style={[styles.installmentCell, styles.installmentHeaderPct]}>{`${row.interes}%`}</Text>
                  <Text style={[styles.installmentCell, styles.installmentHeaderAmount]}>{`$ ${fmt(row.monto)}`}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* TOTAL blue bar — sits at the bottom of the right column AFTER
              the descuentos/interés rows and BEFORE the seña/saldo, so the
              strict hierarchy SUBTOTAL → DESCUENTO → TOTAL → SALDO holds.
              Layout (2026-10-01 cont.4 final): "TOTAL" label on top of the
              blue bar, then the ARS amount (bold, large) and the USD
              equivalent (smaller, lighter) STACKED below in a column so
              both values fit comfortably without overflowing the 30%
              value cell or splitting the ARS from the USD. `wrap: false`
              on `grand` keeps the whole blue box on a single page. */}
          <View style={[styles.grand, { marginTop: 4 }]}>
            <Text style={styles.grandLbl}>TOTAL</Text>
            <View style={styles.grandValWrap}>
              <Text style={styles.grandValArs}>
                {`$ ${fmt(section?.total_ars ?? data.total)}`}
              </Text>
              {(section?.total_usd ?? data.total_usd) > 0 ? (
                <Text style={styles.grandValUsd}>
                  {`(USD $${fmt(section?.total_usd ?? data.total_usd)})`}
                </Text>
              ) : null}
            </View>
          </View>

          {data.document_type === 'work_order'
            ? (data.total_paid_ars > 0 || data.total_paid_usd > 0) ? (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLbl, styles.totalsLblSeña]}>
                  {data.paid_label || 'Seña / Pagos Registrados'}
                </Text>
                <View style={styles.totalsValSeña}>
                  <Text style={styles.totalsValPrimary}>
                    {`$ ${fmt(data.total_paid_ars)}`}
                  </Text>
                  <Text style={styles.totalsValSecondary}>
                    {data.total_paid_usd > 0 ? `USD ${fmt(data.total_paid_usd)}` : ''}
                  </Text>
                </View>
              </View>
            ) : null
            : (data.deposit_received > 0 || data.deposit_usd > 0) ? (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLbl, styles.totalsLblSeña]}>Seña</Text>
                <View style={styles.totalsValSeña}>
                  <Text style={styles.totalsValPrimary}>
                    {data.deposit_currency === 'USD'
                      ? `USD ${fmt(data.deposit_usd)}`
                      : `$ ${fmt(data.deposit_received)}`}
                  </Text>
                  <Text style={styles.totalsValSecondary}>
                    {data.deposit_currency === 'USD'
                      ? `$ ${fmt(data.deposit_ars_equivalent)}`
                      : data.usd_rate > 0
                        ? `USD ${fmt(data.deposit_received / data.usd_rate)}`
                        : ''}
                  </Text>
                </View>
              </View>
            ) : null}
          {(section?.balance_due ?? data.balance_due) > 0 && showSaldo ? (
            <View style={styles.totalsRow} wrap={false}>
              <Text style={styles.totalsLbl}>Saldo pendiente</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(section?.balance_due ?? data.balance_due)}`}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {data.payment_method ? (
        <View style={styles.paymentRow}>
          <Text>
            <Text style={styles.label}>Forma de pago: </Text>
            <Text>{data.payment_method}</Text>
            {(section?.catalogue_installment_detail ?? data.catalogue_installment_detail)?.length > 0 ? (
              <Text>
                {data.installments > 1
                  ? ` (${data.installments} cuotas con ${(section?.catalogue_installment_detail ?? data.catalogue_installment_detail)[0].interes}% de interés por cuota)`
                  : ` (con ${(section?.catalogue_installment_detail ?? data.catalogue_installment_detail)[0].interes}% de interés)`}
              </Text>
            ) : null}
          </Text>
          {data.payment_method === PAYMENT_METHOD_TRANSFER ? (
            <View style={styles.bankRow}>
              <Text>
                <Text style={styles.label}>{`ALIAS: `}</Text>
                <Text>{BANK_INFO.alias}</Text>
              </Text>
              <Text>
                <Text style={styles.label}>{`BANCO: `}</Text>
                <Text>{`${BANK_INFO.banco} a nombre de ${BANK_INFO.titular}`}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* SIGNATURES */}
      <View style={styles.signatures} wrap={false}>
        <View style={styles.signatureCell}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureCaption}>
            {`${data.company.company_name || 'AFAMAR'}\nResponsable`}
          </Text>
        </View>
        <View style={styles.signatureCell}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureCaption}>{'CLIENTE CONFORME\nFirma y aclaración'}</Text>
        </View>
      </View>
    </>
  );
}