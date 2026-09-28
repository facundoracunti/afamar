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

/** One self-contained block per piece (materials + zócalo/frente + additional
 *  works + pools + subtotal) — page 1 of a multi-piece budget. */
export function PieceBlock({ piece }: { piece: PiecesPdfPiece }) {
  const matRows = piece.materials.map(matRowCells);
  const fabRows = piece.fabrication_details.map(fabRowCells);
  const adicRows = piece.additional_works.map(adicRowCells);
  const poolRows = piece.pools.map(poolRowCells);
  const hasContent =
    matRows.length > 0 || fabRows.length > 0 || adicRows.length > 0 || poolRows.length > 0;
  if (!hasContent) return null;

  return (
    // `wrap={false}` keeps the whole piece card together — if it doesn't fit
    // on the remaining page, react-pdf moves the entire block to the next
    // page instead of splitting the tables across the page break. The card
    // chrome (border + title) travels with it so the customer still reads
    // it as a single block.
    <View style={{ ...styles.optSectionBlock, ...styles.optSectionBlockMain }} wrap={false}>
      <Text style={styles.optSectionTitle}>{`Pieza: ${piece.name}`}</Text>

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
          <Text style={styles.optAdicionalBreakdown}>Piletas</Text>
          <DataTable headers={POOL_HEADERS} rows={poolRows} flexes={POOL_FLEXES} />
        </View>
      ) : null}

      <View style={styles.optSectionSubtotal}>
        <Text style={styles.optSectionSubtotalLbl}>Subtotal Pieza</Text>
        <Text style={styles.optSectionSubtotalVal}>{`$ ${fmt(piece.subtotal_ars)}`}</Text>
        {piece.subtotal_usd > 0 ? (
          <Text style={styles.optSectionSubtotalUsd}>{`(USD ${fmt(piece.subtotal_usd)})`}</Text>
        ) : null}
      </View>
    </View>
  );
}