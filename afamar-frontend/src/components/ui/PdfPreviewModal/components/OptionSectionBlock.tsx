import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { MaterialSection } from '../../../../utils/pdf/buildPdfData';
import { styles } from '../DocumentPdf.styles';
import { fmt } from '../DocumentPdf.utils';
import { DataTable } from './Atoms';
import {
  ADDITIONAL_WORKS_FLEXES,
  ADDITIONAL_WORKS_HEADERS,
  adicRowCells,
  FAB_FLEXES,
  FAB_HEADERS,
  fabRowCells,
  MAT_FLEXES,
  MAT_HEADERS,
  matRowCells,
  POOL_FLEXES,
  POOL_HEADERS,
  poolRowCells,
} from './TableRows';

/**
 * Self-contained card per option (PRINCIPAL / ALTERNATIVA). Holds the
 * material rows + zócalo/frente + piletas + trabajos adicionales + the
 * option subtotal so the customer sees the full price of each option in a
 * single block (`data.sections[*]`).
 */
export function OptionSectionBlock({ section }: { section: MaterialSection }) {
  // Pick the card chrome based on whether this is the main option or an
  // alternative. There's no separate global card anymore — the common
  // extras are folded into every section's rows so the customer sees the
  // full price of each option in a single block.
  const blockStyle = section.is_main
    ? styles.optSectionBlockMain
    : styles.optSectionBlockAlt;
  const titleStyle = section.is_main
    ? [styles.optSectionTitle]
    : [styles.optSectionTitle, styles.optSectionTitleAlt];

  const fabRows = section.fabrication_details.map(fabRowCells);
  const matRows = section.materials.map(matRowCells);
  const poolRows = section.pools.map(poolRowCells);
  const adicRows = (section.additional_works || []).map(adicRowCells);

  const hasContent =
    fabRows.length > 0 || matRows.length > 0 || poolRows.length > 0 || adicRows.length > 0;
  if (!hasContent) return null;

  return (
    // No `wrap={false}` here: when a section is too large to fit on the
    // remaining space of the current page, the content needs to flow
    // across pages (otherwise the first page renders empty with just the
    // header/footer, and everything starts on page 2). The card chrome
    // (border/background) will visually repeat at the start of the new
    // page, which is acceptable for a long table.
    <View style={{ ...styles.optSectionBlock, ...blockStyle }}>
      <Text style={titleStyle}>{section.title}</Text>

      {matRows.length > 0 ? (
        <DataTable headers={MAT_HEADERS} rows={matRows} flexes={MAT_FLEXES} />
      ) : null}

      {fabRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={FAB_HEADERS} rows={fabRows} flexes={FAB_FLEXES} clean />
        </View>
      ) : null}

      {poolRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={POOL_HEADERS} rows={poolRows} flexes={POOL_FLEXES} />
        </View>
      ) : null}

      {adicRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={ADDITIONAL_WORKS_HEADERS} rows={adicRows} flexes={ADDITIONAL_WORKS_FLEXES} clean />
        </View>
      ) : null}

      <View style={styles.optSectionSubtotal}>
        <Text style={styles.optSectionSubtotalLbl}>
          {section.is_main ? 'Subtotal Sección' : 'Subtotal Opción'}
        </Text>
        <Text style={styles.optSectionSubtotalVal}>
          {`$ ${fmt(section.subtotal_ars)}`}
        </Text>
        {section.subtotal_usd > 0 ? (
          <Text style={styles.optSectionSubtotalUsd}>
            {`(USD ${fmt(section.subtotal_usd)})`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}