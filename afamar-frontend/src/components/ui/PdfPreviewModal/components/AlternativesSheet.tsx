import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { PiecesPdfPiece } from '../../../../utils/pdf/buildPdfData';
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
 * HOJA DE ALTERNATIVAS — Page 2 in pieces mode. For each piece that has
 * alternatives, renders one self-contained block per alternative with the
 * swapped material + the piece's inherited zócalos, adicionales and
 * piletas + the option subtotal. `wrap={false}` keeps each alternative
 * block on a single page.
 */
export function AlternativesSheet({ pieces }: { pieces: PiecesPdfPiece[] }) {
  const withAlternatives = pieces.filter((p) => p.alternatives.length > 0);
  if (withAlternatives.length === 0) return null;

  return (
    <>
      {withAlternatives.map((piece) => (
        <View key={piece.id || piece.name} wrap={false}>
          <Text style={styles.optSectionTitle}>{`${piece.name} — Alternativas de material`}</Text>

          {piece.alternatives.map((alt, i) => {
            const matRows = alt.materials.map(matRowCells);
            const fabRows = alt.fabrication_details.map(fabRowCells);
            const adicRows = alt.additional_works.map(adicRowCells);
            const poolRows = alt.pools.map(poolRowCells);
            const altLabel = alt.material_name || alt.title || `Alternativa ${i + 1}`;
            return (
              <View
                key={`${piece.id}-alt-${i}`}
                style={{ ...styles.optSectionBlock, ...styles.optSectionBlockAlt, marginTop: 4 }}
                wrap={false}
              >
                <Text style={[styles.optSectionTitle, styles.optSectionTitleAlt]}>
                  {`Alternativa ${i + 1}: ${altLabel}`}
                </Text>

                {matRows.length > 0 ? (
                  <DataTable headers={MAT_HEADERS} rows={matRows} flexes={MAT_FLEXES} />
                ) : null}

                {fabRows.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    <DataTable headers={FAB_HEADERS} rows={fabRows} flexes={FAB_FLEXES} clean />
                  </View>
                ) : null}

                {adicRows.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    <DataTable headers={ADDITIONAL_WORKS_HEADERS} rows={adicRows} flexes={ADDITIONAL_WORKS_FLEXES} clean />
                  </View>
                ) : null}

                {poolRows.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.optAdicionalBreakdown}>Piletas (heredadas)</Text>
                    <DataTable headers={POOL_HEADERS} rows={poolRows} flexes={POOL_FLEXES} />
                  </View>
                ) : null}

                <View style={styles.optSectionSubtotal}>
                  <Text style={styles.optSectionSubtotalLbl}>Subtotal Opción Alternativa</Text>
                  <Text style={styles.optSectionSubtotalVal}>{`$ ${fmt(alt.subtotal_ars)}`}</Text>
                  {alt.subtotal_usd > 0 ? (
                    <Text style={styles.optSectionSubtotalUsd}>
                      {`(USD ${fmt(alt.subtotal_usd)})`}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}