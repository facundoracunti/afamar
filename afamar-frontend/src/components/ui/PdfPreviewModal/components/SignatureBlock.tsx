import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles } from '../DocumentPdf.styles';

/**
 * SIGNATURE BLOCK — "AFAMAR / Responsable" + "Cliente conforme / Firma y
 * aclaración".
 *
 * Extracted from `ExtrasBlock` (2026-10-01) so the multi-option layout
 * can print it on the summary page without dragging the whole document
 * totals block along: a quote with N variants is signed ONCE, not once per
 * variant.
 */
export function SignatureBlock({ companyName }: { companyName?: string }) {
  return (
    <View style={styles.signatures} wrap={false}>
      <View style={styles.signatureCell}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureCaption}>
          {`${companyName || 'AFAMAR'}\nResponsable`}
        </Text>
      </View>
      <View style={styles.signatureCell}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureCaption}>{'CLIENTE CONFORME\nFirma y aclaración'}</Text>
      </View>
    </View>
  );
}

export default SignatureBlock;
