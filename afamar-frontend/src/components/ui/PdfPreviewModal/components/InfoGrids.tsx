import React from 'react';
import { View } from '@react-pdf/renderer';
import type { PdfDocumentData } from '../../../../utils/pdf/buildPdfData';
import { styles } from '../DocumentPdf.styles';
import { InfoCell } from './Atoms';

/** CLIENT info grid (shown on every page so each quote is self-contained). */
export function ClientGrid({ data }: { data: PdfDocumentData }) {
  return (
    <View style={styles.infoGrid}>
      <InfoCell label="Cliente" value={data.client_name} />
      <InfoCell label="Teléfono" value={data.client_phone} />
      <InfoCell label="Domicilio" value={data.client_address} />
      <InfoCell label="Correo" value={data.client_email} />
      <InfoCell label="Fecha" value={data.date} />
      <InfoCell label="Fecha de Entrega" value={data.delivery_date} />
    </View>
  );
}

/** SPECS info grid (Color / Espesor / Acabado) — only on the principal page. */
export function SpecsGrid({ data }: { data: PdfDocumentData }) {
  return (
    <View style={styles.infoGrid}>
      <InfoCell label="Color" value={data.material_color} />
      <InfoCell label="Espesor" value={data.material_thickness} />
      <InfoCell label="Acabado" value={data.material_finish} />
    </View>
  );
}