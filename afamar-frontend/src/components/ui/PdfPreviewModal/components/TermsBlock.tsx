import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { PdfDocumentData } from '../../../../utils/pdf/buildPdfData';
import { styles } from '../DocumentPdf.styles';
import { TermsList } from './Atoms';

/** Per-page terms (rendered on every page so each option quote is
 *  self-contained with its own header/terms/footer). The first term block
 *  (Condiciones de entrega on OTs / Términos del presupuesto on budgets)
 *  is rendered side by side with the METODO DE PAGO reference box, then
 *  Garantía goes full-width below. */
export function TermsBlock({ data }: { data: PdfDocumentData }) {
  return (
    <>
      <View style={styles.termsRow}>
        {(data.document_type === 'budget'
          ? data.budget_terms_list
          : data.delivery_terms_list
        ).length > 0 ? (
          <View style={styles.termsRowCol}>
            {data.document_type === 'budget' ? (
              <TermsList title="Términos del presupuesto" items={data.budget_terms_list} />
            ) : (
              <TermsList title="Condiciones de entrega" items={data.delivery_terms_list} />
            )}
          </View>
        ) : null}
        {data.payment_methods_catalogue.length > 0 ? (
          <View style={styles.paymentMethodsBox}>
            <Text style={styles.termsTitle}>Metodo de pago</Text>
            {data.payment_methods_catalogue.map((name) => (
              <Text key={name} style={styles.paymentMethodsItem}>
                {name}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      <TermsList title="Garantía" items={data.warranty_terms_list} />
    </>
  );
}