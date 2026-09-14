/**
 * React-PDF document for the "FICHA DE TALLER" (workshop sheet).
 *
 * A SEPARATE document from the client-facing PDF (`DocumentPdf`): NO prices,
 * NO totals, NO payment terms. Printed FOR the shop-floor workers and given
 * to them with the physical order — same croquis / plano they need to build
 * the work, plus the technical spec grid (Corte / Faja / Perf / Tras-PEG /
 * Term / Sopapas) printed BLANK so they fill the values by hand with pen.
 *
 * Kept intentionally close in visual language to `DocumentPdf` (same
 * header/logo, same accent color) so both documents feel like they come
 * from the same company, but with a much simpler, technical layout.
 */
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { API_URL } from '../../../api/http';
import { POOL_MATERIAL_GLOBAL } from '../../../types/budget';
import type { WorkshopPdfData } from '../../../utils/pdf/buildWorkshopPdfData';

const FONT = 'Helvetica';
const ACCENT = '#c0392b';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_200 = '#e2e8f0';
const SLATE_100 = '#f1f5f9';
const TEXT_DARK = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    lineHeight: 1.4,
    color: TEXT_DARK,
    paddingTop: 10 * 2.83,
    paddingBottom: 10 * 2.83,
    paddingHorizontal: 10 * 2.83,
  },
  // ===== HEADER =====
  headerRow: { flexDirection: 'row', marginBottom: 3 },
  headerLeft: { width: '60%', flexDirection: 'row', alignItems: 'flex-start' },
  headerLeftLogo: { width: '28%' },
  headerLeftInfo: { width: '72%' },
  headerRight: { width: '40%', textAlign: 'right' },
  logo: { width: '86%', maxHeight: 62, objectFit: 'contain' },
  tagline: { fontSize: 10, fontWeight: 'bold', color: SLATE_700, lineHeight: 1.2, marginBottom: 2 },
  contactLine: { fontSize: 8, color: SLATE_700, lineHeight: 1.35 },
  docTitle: { fontSize: 11, fontWeight: 'bold', color: ACCENT, lineHeight: 1.2 },
  docNumber: { fontSize: 14, fontWeight: 'bold', color: ACCENT, fontFamily: 'Courier', marginTop: 1 },
  divider: { borderTop: `1px solid ${ACCENT}`, marginVertical: 3 },

  // ===== INFO ROW =====
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 1 },
  infoCell: { width: '50%', fontSize: 9, marginBottom: 2, paddingRight: 6 },
  infoLabel: { color: SLATE_500 },
  infoValue: { fontWeight: 'bold', color: '#0f172a' },

  // ===== PILETAS / MESADAS TABLE =====
  poolsBox: {
    marginTop: 2,
    marginBottom: 2,
    border: `1px solid ${SLATE_200}`,
    borderRadius: 3,
  },
  poolsHeader: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    backgroundColor: SLATE_100,
    borderBottom: `1px solid ${SLATE_200}`,
  },
  poolsHeaderModel: { flex: 1, fontSize: 7.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase', letterSpacing: 0.05 },
  poolsHeaderTarget: { width: '38%', fontSize: 7.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase', letterSpacing: 0.05, textAlign: 'right' },
  poolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottom: `1px solid ${SLATE_100}`,
  },
  poolModel: { flex: 1, fontSize: 9, fontWeight: 'bold', color: TEXT_DARK },
  poolTargetWrap: { width: '38%', alignItems: 'flex-end' },
  poolTarget: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: ACCENT,
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  poolGlobal: {
    fontSize: 8,
    color: SLATE_500,
    backgroundColor: SLATE_100,
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    fontStyle: 'italic',
  },
  poolsEmpty: { paddingHorizontal: 6, paddingVertical: 3, fontSize: 9, color: SLATE_500 },

  // ===== SKETCH =====
  sketchBox: {
    marginVertical: 4,
    padding: 5,
    border: `1px solid ${SLATE_200}`,
    backgroundColor: SLATE_100,
  },
  sketchTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.06,
    marginBottom: 3,
  },
  sketchImg: {
    width: '100%',
    objectFit: 'contain',
    backgroundColor: '#ffffff',
  },
  sketchPageCaption: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
    marginBottom: 1,
  },
  sketchPage: { marginBottom: 3 },
  sketchEmpty: {
    color: SLATE_500,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // ===== SPEC GRID + OBS (kept as an atomic block so it NEVER splits) =====
  specsBlock: {},
  specsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.06,
    marginTop: 5,
    marginBottom: 3,
  },
  specsGrid: { flexDirection: 'row', marginHorizontal: -3 },
  specCell: { width: '16.666%', alignItems: 'center' },
  specBox: {
    width: 62,
    minHeight: 50,
    border: `1px solid ${SLATE_200}`,
    borderRadius: 2,
  },
  specLabelRow: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: SLATE_100,
    borderBottom: `1px solid ${SLATE_200}`,
  },
  specLabel: { fontSize: 6, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase' },
  specValue: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 10,
    color: SLATE_500,
  },

  // ===== OBS =====
  obsBox: {
    marginTop: 5,
    border: `1px solid ${SLATE_200}`,
    height: 60,
  },
  obsTitleRow: {
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    backgroundColor: SLATE_100,
    borderBottom: `1px solid ${SLATE_200}`,
  },
  obsTitle: { fontSize: 7.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase' },
  obsBody: { padding: 4, fontSize: 8.5, color: TEXT_DARK },
});

/** Absolute URL for the company logo (served from /uploads/logo.png). */
function logoUrl(company: WorkshopPdfData['company']): string | null {
  const path = company.company_logo || '/uploads/logo.png';
  if (!path) return null;
  const base = API_URL.endsWith('/api/v1') ? API_URL.slice(0, -'/api/v1'.length) : '';
  return path.startsWith('http') ? path : `${base}${path}`;
}

interface WorkshopSheetProps {
  data: WorkshopPdfData;
}

export default function WorkshopSheet({ data }: WorkshopSheetProps) {
  const logo = logoUrl(data.company);

  // The croquis PNGs come out of `SketchImageExtractor` at 1480×600
  // (aspect ~2.47): at full content width (~526pt on A4) each image is
  // ~213pt tall, and two pages already overflow the sheet. To keep the whole
  // sheet on ONE page (header, pools, croquis, spec grid, obs), the image
  // heights are computed from a fixed budget so they shrink as the number
  // of sketch pages grows — never mid-cutting the spec grid at a page split.
  const SKETCH_BUDGET = 400;
  const SKETCH_MIN = 90;
  const SKETCH_MAX = 214; // natural full-width height (~526 / 2.47)
  const sketchCount = Math.max(data.sketch_pages.length, 1);
  const sketchImgHeight = Math.min(
    SKETCH_MAX,
    Math.max(SKETCH_MIN, SKETCH_BUDGET / sketchCount - 16),
  );

  const specRow = (row: WorkshopPdfData['specs']) => (
    <View style={styles.specsGrid}>
      {row.map((cell) => (
        <View key={cell.key} style={styles.specCell}>
          <View style={styles.specBox}>
            <View style={styles.specLabelRow}>
              <Text style={styles.specLabel}>{cell.label}</Text>
            </View>
            <Text style={styles.specValue}>
              {cell.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <Document title={`Ficha de Taller ${data.number}`} author={data.company.company_name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {logo ? (
              <View style={styles.headerLeftLogo}>
                <Image style={styles.logo} src={logo} />
              </View>
            ) : null}
            <View style={styles.headerLeftInfo}>
              <Text style={styles.tagline}>
                {data.company.company_tagline || data.company.company_name || 'AFAMAR'}
              </Text>
              <Text style={styles.contactLine}>{data.company.company_address}</Text>
              <Text style={styles.contactLine}>
                {[data.company.company_phone, data.company.company_email]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>FICHA DE TALLER</Text>
            <Text style={styles.docNumber}>N° {data.number || '—'}</Text>
            {data.date ? <Text style={styles.contactLine}>Fecha: {data.date}</Text> : null}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text>
              <Text style={styles.infoLabel}>Material: </Text>
              <Text style={styles.infoValue}>
                {data.materials.length > 0 ? data.materials.join('\n') : '—'}
              </Text>
            </Text>
          </View>
          {data.client_name ? (
            <View style={styles.infoCell}>
              <Text>
                <Text style={styles.infoLabel}>Cliente: </Text>
                <Text style={styles.infoValue}>{data.client_name}</Text>
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.poolsBox}>
          <View style={styles.poolsHeader}>
            <Text style={styles.poolsHeaderModel}>Pileta</Text>
            <Text style={styles.poolsHeaderTarget}>Va en la mesada</Text>
          </View>
          {data.pools.length > 0 ? (
            data.pools.map((p) => {
              const global = p.material === POOL_MATERIAL_GLOBAL;
              return (
                <View key={p.label} style={styles.poolsRow}>
                  <Text style={styles.poolModel}>{p.label}</Text>
                  <View style={styles.poolTargetWrap}>
                    {global ? (
                      <Text style={styles.poolGlobal}>Global</Text>
                    ) : (
                      <Text style={styles.poolTarget}>{p.display || '—'}</Text>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.poolsEmpty}>Sin piletas</Text>
          )}
        </View>

        <View style={styles.sketchBox}>
          <Text style={styles.sketchTitle}>Plano / Croquis</Text>
          {data.sketch_pages.length > 0 ? (
            data.sketch_pages.map((pg) => (
              <View key={(pg.image || '').slice(0, 32)} style={styles.sketchPage} wrap={false}>
                <Text style={styles.sketchPageCaption}>
                  {[pg.name, pg.material].filter(Boolean).join(' — ')}
                </Text>
                <Image
                  style={[styles.sketchImg, { height: sketchImgHeight }]}
                  src={pg.image}
                />
              </View>
            ))
          ) : (
            <Text style={styles.sketchEmpty}>Sin croquis cargado</Text>
          )}
        </View>

        <View style={styles.specsBlock} wrap={false}>
          <Text style={styles.specsTitle}>Especificaciones para el taller</Text>
          {specRow(data.specs)}

          <View style={styles.obsBox}>
            <View style={styles.obsTitleRow}>
              <Text style={styles.obsTitle}>Observaciones</Text>
            </View>
            <Text style={styles.obsBody}>{data.design_observations}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}