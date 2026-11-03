import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { ApprovalGlobalPdfLine } from '../../../../utils/pdf/pdfTypes.piece';
import { styles } from '../DocumentPdf.styles';
import { DataTable } from './Atoms';

const HEADERS = [
  { label: 'Concepto' },
  { label: 'Detalle' },
  { label: 'Subtotal', num: true },
];

export function ApprovalGlobalLines({ lines }: { lines: ApprovalGlobalPdfLine[] }) {
  if (lines.length === 0) return null;
  return (
    <View wrap={false}>
      <Text style={styles.sectionTitle}>Conceptos globales aprobados</Text>
      <DataTable
        headers={HEADERS}
        flexes={[2, 2, 1.4]}
        rows={lines.map((line) => [line.name, line.detail, `${line.currency} ${line.total_str}`])}
        clean
      />
    </View>
  );
}
