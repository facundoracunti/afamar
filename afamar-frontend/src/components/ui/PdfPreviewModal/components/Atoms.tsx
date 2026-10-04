import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles } from '../DocumentPdf.styles';

/** DataTable that adapts columns to whatever data is present so we don't
 *  have to keep three builders in lockstep: fabrication, materials, pools.
 *  Each cell is wrapped in a <View flex={n}> so the column width is identical
 *  on the header and every row — this is what makes them align in react-pdf. */
export function DataTable({
  headers,
  rows,
  flexes,
  clean = false,
  sectionHeaderFlags,
}: {
  headers: { label: string; num?: boolean }[];
  rows: (string | null)[][];
  flexes?: number[];
  /** "Clean" mode (Conceptos / Adicionales): rows where EVERY cell is
   *  empty are dropped, columns where EVERY cell is empty are dropped
   *  (header + flex included), and the remaining empty cells render blank
   *  instead of the `—` placeholder — no orphan dashes, no empty columns. */
  clean?: boolean;
  /** Parallel array to `rows`. `true` at index i marks the i-th row as a
   *  section header (rendered as a bold band spanning every column).
   *  Used by the COMPARATIVA DE MEDICIÓN to group rows by piece
   *  ("COCINA" / "PARRILLA" headers). Optional — if omitted, every row
   *  is treated as a regular data row. */
  sectionHeaderFlags?: boolean[];
}) {
  if (rows.length === 0) return null;

  const nonEmpty = (c: string | null) => c != null && c !== '';
  let keptRows = rows;
  let keptHeaders = headers;
  let keptFlexes = flexes;
  let keptSectionFlags = sectionHeaderFlags;
  if (clean) {
    keptRows = rows.filter((row, ri) => sectionHeaderFlags?.[ri] === true || row.some(nonEmpty));
    if (keptRows.length === 0) return null;
    const keptCols = headers.map((_, ci) => keptRows.some((row) => nonEmpty(row[ci])));
    if (keptCols.every((k) => !k)) return null;
    keptHeaders = headers.filter((_, ci) => keptCols[ci]);
    keptFlexes = flexes ? flexes.filter((_, ci) => keptCols[ci]) : undefined;
    keptSectionFlags = keptSectionFlags?.filter((_, ri) => keptRows[ri] != null);
    keptRows = keptRows.map((row) => row.filter((_, ci) => keptCols[ci]));
  }

  const colFlex = (i: number) => (keptFlexes && keptFlexes[i] != null ? keptFlexes[i] : 1);

  return (
    <View>
      <View style={styles.tableHead}>
        {keptHeaders.map((h, i) => {
          const isLast = i === keptHeaders.length - 1;
          return (
            <View key={h.label} style={{ flex: colFlex(i), ...(isLast ? styles.cellLast : styles.cell) }}>
              <Text style={h.num ? styles.thTextNum : styles.thText}>{h.label}</Text>
            </View>
          );
        })}
      </View>
      {keptRows.map((row, ri) => {
        const isSectionHeader = keptSectionFlags?.[ri] === true;
        if (isSectionHeader) {
          // Section header row: full-width bold band with the piece name.
          return (
            <View key={`section-${ri}-${String(row[0] ?? '')}`} style={styles.tableSectionHeader}>
              <Text style={styles.tableSectionHeaderText}>
                {String(row[0] ?? '').toUpperCase()}
              </Text>
            </View>
          );
        }
        return (
          <View key={String(row[0] ?? `row-${ri}`)} style={styles.tableRow}>
            {row.map((cell, ci) => {
              const isLast = ci === row.length - 1;
              const isDash = cell == null || cell === '';
              const value = isDash ? (clean ? '' : '—') : cell;
              return (
                <View key={keptHeaders[ci]?.label ?? `cell-${ci}`} style={{ flex: colFlex(ci), ...(isLast ? styles.cellLast : styles.cell) }}>
                  <Text style={keptHeaders[ci]?.num ? styles.tdTextNum : styles.tdText}>
                    {isDash ? <Text style={{ color: '#64748b' }}>{value}</Text> : value}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function InfoCell({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.infoCell}>
      <Text>
        <Text style={styles.label}>{label}: </Text>
        <Text style={styles.value}>{value}</Text>
      </Text>
    </View>
  );
}

export function ObsBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.obsBox}>
      <Text style={styles.obsTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function TermsList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.termsBox} wrap={false}>
      <Text style={styles.termsTitle}>{title}</Text>
      {items.map((t) => (
        <Text key={t} style={styles.termsListItem}>{`• ${t}`}</Text>
      ))}
    </View>
  );
}