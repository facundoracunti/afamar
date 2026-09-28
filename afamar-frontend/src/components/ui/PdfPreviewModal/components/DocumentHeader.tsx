import React from 'react';
import { Image, Text, View } from '@react-pdf/renderer';
import type { PdfDocumentData } from '../../../../utils/pdf/buildPdfData';
import { logoUrl } from '../DocumentPdf.utils';
import { styles } from '../DocumentPdf.styles';

/**
 * Membrete (logo + datos de la empresa + N° de presupuesto + subtítulo).
 * Renders IN-FLOW at the top of each `<Page>` so the rest of the page
 * content (client grid, piece blocks, totals) flows naturally below it
 * with no overlap. Using `position: absolute` + `fixed` here caused the
 * client info to paint on top of the logo because the logo is much taller
 * than the page's `paddingTop` reserves.
 */
export function DocumentHeader({ data }: { data: PdfDocumentData }) {
  const logo = logoUrl(data.company);
  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {logo ? (
            <View style={styles.headerLeftLogo}>
              <Image style={styles.logo} src={logo} />
            </View>
          ) : null}
          <View style={styles.headerLeftInfo}>
            {data.company.company_tagline ? (
              <Text style={styles.tagline}>{data.company.company_tagline}</Text>
            ) : null}
            {data.company.company_address ? (
              <Text style={styles.contactLine}>{data.company.company_address}</Text>
            ) : null}
            {data.company.company_phone ? (
              <Text style={styles.contactLine}>{`Tel: ${data.company.company_phone}`}</Text>
            ) : null}
            {data.company.company_email ? (
              <Text style={styles.contactLine}>{data.company.company_email}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.docTitle}>{data.title}</Text>
          <Text style={styles.docNumber}>{data.number || '—'}</Text>
          {/* Validity line (2026-09-25 mañana) — moved from below the header
              row to directly under the document number so it doesn't push
              the logo container down. Budget-only. */}
          {data.document_type === 'budget' && data.company.budget_validity_text ? (
            <Text style={styles.validityText}>{data.company.budget_validity_text}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.divider} />
    </View>
  );
}