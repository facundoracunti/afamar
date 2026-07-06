/**
 * React-PDF document definition for the AFAMAR budget and work-order PDFs.
 *
 * Single source of truth for both document types — the `document_type`
 * prop drives title + which terms block renders. Mirrors the visual layout
 * of the legacy `app/templates/document_pdf.html` (xhtml2pdf + Jinja2),
 * but rendered with `@react-pdf/renderer` so the text is selectable, the
 * layouts flow between pages automatically, and the layout is unaffected
 * by the host OS.
 *
 * NOTE: react-pdf ships a `<Font/>` registry override; embeding Helvetica
 * is unnecessary because it's a default PDF font.
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
import type { PdfDocumentData } from '../../../utils/pdf/buildPdfData';
import { API_URL } from '../../../api/http';
import { BANK_INFO, PAYMENT_METHOD_TRANSFER } from '../../../constants';

const FONT = 'Helvetica';
const ACCENT = '#c0392b';
const HEADER_RED = '#c0392b';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const SLATE_200 = '#e2e8f0';
const SLATE_100 = '#f1f5f9';
const SLATE_50 = '#f8fafc';
const AMBER_700 = '#92400e';
const AMBER_200 = '#fde68a';
const AMBER_50 = '#fffbeb';
const BLUE_700 = '#1e40af';
const YELLOW_50 = '#fef9c3';
const TEXT_DARK = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    lineHeight: 1.4,
    color: TEXT_DARK,
    paddingTop: 14 * 2.83,
    paddingBottom: 16 * 2.83,
    paddingHorizontal: 12 * 2.83,
  },
  // ===== HEADER =====
  headerRow: { flexDirection: 'row', marginBottom: 8 },
  headerLeft: { width: '65%', flexDirection: 'row', alignItems: 'flex-start' },
  headerLeftLogo: { width: '28%' },
  headerLeftInfo: { width: '72%' },
  headerRight: { width: '35%', textAlign: 'right' },
  logo: { width: '100%', maxHeight: 142, marginBottom: 0, objectFit: 'contain' },
  tagline: { fontSize: 10, fontWeight: 'bold', color: SLATE_700, lineHeight: 1.2, marginBottom: 2 },
  contactLine: { fontSize: 8, color: SLATE_700, lineHeight: 1.4 },
  docTitle: { fontSize: 13, fontWeight: 'bold', color: HEADER_RED, lineHeight: 1.2, marginTop: 10 },
  docNumber: { fontSize: 18, fontWeight: 'bold', color: HEADER_RED, fontFamily: 'Courier', marginTop: 2 },
  docSub: { fontSize: 8, color: SLATE_500, marginTop: 6 },
  divider: { borderTop: `2px solid ${HEADER_RED}`, marginVertical: 4 },
  dividerLight: { borderTop: `1px solid ${SLATE_200}`, marginVertical: 4 },
  // ===== INFO-GRID =====
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  infoCell: { width: '50%', fontSize: 8.5, marginBottom: 2, paddingRight: 6 },
  label: { fontWeight: 'bold' },
  value: { fontWeight: 'bold', color: '#0f172a' },
  // ===== OBS BOX =====
  obsBox: { backgroundColor: AMBER_50, border: `1px solid ${AMBER_200}`, padding: 6, marginBottom: 8 },
  obsTitle: { fontSize: 8, fontWeight: 'bold', color: AMBER_700, textTransform: 'uppercase', marginBottom: 2 },
  obsText: { fontSize: 8.5 },
  obsList: { fontSize: 8.5, marginTop: 2 },
  obsListItem: { marginBottom: 2 },
  // ===== CROQUIS =====
  croquisBox: { backgroundColor: SLATE_50, border: `1px solid ${SLATE_200}`, padding: 6, marginBottom: 8 },
  croquisTitle: { fontSize: 8, fontWeight: 'bold', color: SLATE_700, textTransform: 'uppercase', marginBottom: 2 },
  croquisImg: { maxWidth: '100%', maxHeight: 180, objectFit: 'contain', marginVertical: 4 },
  // ===== SECTION TITLE =====
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: ACCENT, textTransform: 'uppercase', marginTop: 8, marginBottom: 4, paddingBottom: 2, borderBottom: `1px solid ${ACCENT}` },
  // ===== DATA TABLE =====
  // Each column is a <View> with flex — this keeps headers and cells aligned
  // because the flex ratio is identical on every row.
  tableHead: { flexDirection: 'row', backgroundColor: SLATE_100, borderBottom: `1px solid ${SLATE_400}` },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${SLATE_200}` },
  cell: { paddingVertical: 4, paddingHorizontal: 6, borderRight: `1px solid ${SLATE_200}` },
  cellLast: { paddingVertical: 4, paddingHorizontal: 6 },
  thText: { fontSize: 7.5, fontWeight: 'bold', color: SLATE_700 },
  thTextNum: { fontSize: 7.5, fontWeight: 'bold', color: SLATE_700, textAlign: 'right' },
  tdText: { fontSize: 8.5 },
  tdTextNum: { fontSize: 8.5, textAlign: 'right' },
  dash: { color: SLATE_500 },
  // ===== TOTALS =====
  totals: { marginTop: 8 },
  totalsRow: { flexDirection: 'row', paddingVertical: 2 },
  totalsLbl: { width: '70%', textAlign: 'right', color: SLATE_700 },
  totalsVal: { width: '30%', textAlign: 'right', fontWeight: 'bold' },
  grand: { flexDirection: 'row', backgroundColor: BLUE_700, paddingVertical: 6, paddingHorizontal: 8, marginTop: 4 },
  grandLbl: { width: '70%', color: '#fff', fontWeight: 'bold' },
  grandVal: { width: '30%', color: '#fff', fontWeight: 'bold', textAlign: 'right' },
  grandUsdSub: { fontSize: 8, color: '#fff', opacity: 0.85 },
  // ===== PAYMENT METHOD =====
  paymentRow: { fontSize: 8.5, marginTop: 4, marginBottom: 4 },
  // Bank details block printed under the payment method when the
  // customer picks "Transferencia Bancaria". Slightly indented and
  // muted to make it clear it's a follow-up detail, not a new section.
  bankRow: { fontSize: 8.5, marginLeft: 8, marginTop: 0, marginBottom: 4, color: SLATE_700 },
  // ===== TERMS =====
  termsBox: { marginTop: 6 },
  termsTitle: { fontSize: 9, fontWeight: 'bold', color: BLUE_700, textTransform: 'uppercase', marginBottom: 2 },
  termsText: { fontSize: 8.5 },
  termsListItem: { fontSize: 8.5, marginBottom: 2 },
  // ===== SIGNATURES =====
  signatures: { flexDirection: 'row', marginTop: 30 },
  signatureCell: { width: '50%', textAlign: 'center', paddingHorizontal: 8 },
  signatureLine: { borderTopWidth: 1, borderTopColor: TEXT_DARK, paddingTop: 2, minHeight: 6 },
  signatureCaption: { fontSize: 7.5, color: SLATE_500, marginTop: 0.5 },
  // ===== FOOTER =====
  footer: { position: 'absolute', bottom: 8 * 2.83, left: 12 * 2.83, right: 12 * 2.83, textAlign: 'center', fontSize: 7, color: SLATE_500 },
  emptyRow: { fontSize: 8, color: SLATE_500, fontStyle: 'italic', paddingVertical: 4 },
});

function fmt(v: number): string {
  return (v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Build the absolute URL for the company logo (served from /uploads/logo.png).
 *  Falls back to no logo when company_logo is empty. */
function logoUrl(company: PdfDocumentData['company']): string | null {
  const path = company.company_logo || '/uploads/logo.png';
  // API_URL has the form "/api/v1" — strip the trailing v1 path segment to
  // reach the same host root the uploads are served from.
  const base = API_URL.endsWith('/api/v1') ? API_URL.slice(0, -'/api/v1'.length) : '';
  if (!path) return null;
  return path.startsWith('http') ? path : `${base}${path}`;
}

interface DocumentPdfProps {
  data: PdfDocumentData;
}

/** DataTable that adapts columns to whatever data is present so we don't
 *  have to keep three builders in lockstep: fabrication, materials, pools.
 *  Each cell is wrapped in a <View flex={n}> so the column width is identical
 *  on the header and every row — this is what makes them align in react-pdf. */
function DataTable({
  headers,
  rows,
  flexes,
}: {
  headers: { label: string; num?: boolean }[];
  rows: (string | null)[][];
  flexes?: number[];
}) {
  if (rows.length === 0) return null;
  const colFlex = (i: number) => (flexes && flexes[i] != null ? flexes[i] : 1);

  return (
    <View>
      <View style={styles.tableHead}>
        {headers.map((h, i) => {
          const isLast = i === headers.length - 1;
          return (
            <View key={i} style={{ flex: colFlex(i), ...(isLast ? styles.cellLast : styles.cell) }}>
              <Text style={h.num ? styles.thTextNum : styles.thText}>{h.label}</Text>
            </View>
          );
        })}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.tableRow}>
          {row.map((cell, ci) => {
            const isLast = ci === row.length - 1;
            const isDash = cell == null || cell === '';
            const value = isDash ? '—' : cell;
            return (
              <View key={ci} style={{ flex: colFlex(ci), ...(isLast ? styles.cellLast : styles.cell) }}>
                <Text style={headers[ci]?.num ? styles.tdTextNum : styles.tdText}>
                  {isDash ? <Text style={{ color: SLATE_500 }}>{value}</Text> : value}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
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

function ObsBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.obsBox}>
      <Text style={styles.obsTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TermsList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.termsBox} wrap={false}>
      <Text style={styles.termsTitle}>{title}</Text>
      {items.map((t, i) => (
        <Text key={i} style={styles.termsListItem}>{`• ${t}`}</Text>
      ))}
    </View>
  );
}

export default function DocumentPdf({ data }: DocumentPdfProps) {
  const logo = logoUrl(data.company);
  const headerLeftRight = (
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
        {data.doc_sub ? <Text style={styles.docSub}>{data.doc_sub}</Text> : null}
      </View>
    </View>
  );

  const clientGrid = (
    <View style={styles.infoGrid}>
      <InfoCell label="Cliente" value={data.client_name} />
      <InfoCell label="Teléfono" value={data.client_phone} />
      <InfoCell label="Domicilio" value={data.client_address} />
      <InfoCell label="Email" value={data.client_email} />
      <InfoCell label="Fecha" value={data.date} />
    </View>
  );

  const specsGrid = (
    <View style={styles.infoGrid}>
      <InfoCell label="Color" value={data.material_color} />
      <InfoCell label="Espesor" value={data.material_thickness} />
      <InfoCell label="Acabado" value={data.material_finish} />
      <InfoCell label="Entrega" value={data.delivery_date} />
    </View>
  );

  const fabricationHeaders = [
    { label: 'Concepto' },
    { label: 'Detalle' },
    { label: 'Material' },
    { label: 'Largo', num: true },
    { label: 'Ancho', num: true },
    { label: 'M²/Cant', num: true },
    { label: 'Precio', num: true },
  ];
  const fabricationRows = data.fabrication_details.map((d) => [
    d.concept,
    d.detail,
    d.material,
    d.show_length && d.length_str ? d.length_str : null,
    d.show_width && d.width_str ? d.width_str : null,
    d.show_m2 ? d.m2_label : d.show_quantity ? String(d.quantity) : null,
    `$ ${d.price_str}`,
  ]);

  const materialHeaders = [
    { label: 'Material' },
    { label: 'Color' },
    { label: 'Largo', num: true },
    { label: 'Ancho', num: true },
    { label: 'Cant.', num: true },
    { label: 'M²', num: true },
    { label: 'Precio/m²', num: true },
    { label: 'Subtotal', num: true },
  ];
  const materialRows = data.materials.map((m) => [
    m.name,
    m.color,
    m.length_str,
    m.width_str,
    String(m.quantity),
    m.m2_str,
    `$ ${m.price_m2_str}`,
    `$ ${m.subtotal_str}`,
  ]);

  const poolHeaders = [
    { label: 'Marca' },
    { label: 'Modelo' },
    { label: 'Cant.', num: true },
    { label: 'Precio', num: true },
    { label: 'Subtotal', num: true },
  ];
  const poolRows = data.pools.map((p) => [
    p.brand,
    p.model,
    String(p.quantity),
    `$ ${p.price_str}`,
    `$ ${p.subtotal_str}`,
  ]);

  return (
    <Document title={`${data.title} ${data.number}`} author={data.company.company_name}>
      <Page size="A4" style={styles.page} wrap>
        {/* HEADER */}
        {headerLeftRight}
        <View style={styles.divider} />

        {/* CLIENT */}
        {clientGrid}
        <View style={styles.dividerLight} />

        {/* INFO-BOX */}
        {specsGrid}

        {/* CROQUIS */}
        {data.sketch_images.length > 0 ? (
          <View style={styles.croquisBox}>
            <Text style={styles.croquisTitle}>Croquis</Text>
            {data.sketch_images.map((img, i) => (
              <Image key={i} style={styles.croquisImg} src={img} />
            ))}
          </View>
        ) : null}

        {/* FABRICATION */}
        {data.fabrication_details.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Detalles de fabricación</Text>
            <DataTable headers={fabricationHeaders} rows={fabricationRows} flexes={[2, 2, 1.5, 1, 1, 1, 1]} />
          </View>
        ) : null}

        {/* MATERIALS */}
        {data.materials.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Materiales</Text>
            <DataTable headers={materialHeaders} rows={materialRows} flexes={[2, 1.5, 1, 1, 0.8, 1, 1.2, 1.2]} />
          </View>
        ) : null}

        {/* POOLS */}
        {data.pools.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Piletas</Text>
            <DataTable headers={poolHeaders} rows={poolRows} flexes={[2, 2, 1, 1.5, 1.5]} />
          </View>
        ) : null}

        {/* OBSERVATIONS */}
        {data.notes ? (
          <ObsBox title="Observaciones">
            <Text style={styles.obsText}>{data.notes}</Text>
          </ObsBox>
        ) : null}
        {data.important_observations ? (
          <ObsBox title="Observaciones importantes">
            {data.important_observations_list.length > 0 ? (
              data.important_observations_list.map((t, i) => (
                <Text key={i} style={styles.obsListItem}>{`• ${t}`}</Text>
              ))
            ) : (
              <Text style={styles.obsText}>{data.important_observations}</Text>
            )}
          </ObsBox>
        ) : null}

        {/* TOTALS */}
        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLbl}>Subtotal</Text>
            <Text style={styles.totalsVal}>{`$ ${fmt(data.subtotal)}`}</Text>
          </View>
          {data.transport > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>Traslado</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(data.transport)}`}</Text>
            </View>
          ) : null}
          {data.discount_percentage > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>{`Descuento (${data.discount_percentage}%)`}</Text>
              <Text style={styles.totalsVal}>{`-$ ${fmt(data.discount_fixed_amount)}`}</Text>
            </View>
          ) : null}
          {data.deposit_received > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>Seña</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(data.deposit_received)}`}</Text>
            </View>
          ) : null}
          {data.balance_due > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLbl}>Saldo pendiente</Text>
              <Text style={styles.totalsVal}>{`$ ${fmt(data.balance_due)}`}</Text>
            </View>
          ) : null}
          <View style={styles.grand}>
            <Text style={styles.grandLbl}>TOTAL</Text>
            <Text style={styles.grandVal}>
              {`$ ${fmt(data.total)}`}
              {data.total_usd > 0 ? <Text style={styles.grandUsdSub}>{`  (USD $${fmt(data.total_usd)})`}</Text> : null}
            </Text>
          </View>
        </View>

        {data.payment_method ? (
          <View style={styles.paymentRow}>
            <Text>
              <Text style={styles.label}>Forma de pago: </Text>
              <Text>{data.payment_method}</Text>
              {data.installments && data.installments > 1 ? (
                <Text>{` (${data.installments} cuotas)`}</Text>
              ) : null}
            </Text>
            {data.payment_method === PAYMENT_METHOD_TRANSFER ? (
              <View style={styles.bankRow}>
                <Text>
                  <Text style={styles.label}>{`ALIAS: `}</Text>
                  <Text>{BANK_INFO.alias}</Text>
                </Text>
                <Text>
                  <Text style={styles.label}>{`BANCO: `}</Text>
                  <Text>{`${BANK_INFO.banco} a nombre de ${BANK_INFO.titular}`}</Text>
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* TERMS */}
        {data.document_type === 'budget' ? (
          <>
            <TermsList title="Términos del presupuesto" items={data.budget_terms_list} />
            <TermsList title="Garantía" items={data.warranty_terms_list} />
          </>
        ) : (
          <>
            <TermsList title="Condiciones de entrega" items={data.delivery_terms_list} />
            <TermsList title="Garantía" items={data.warranty_terms_list} />
          </>
        )}

        {/* SIGNATURES */}
        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureCell}>
            <Text style={styles.signatureLine}>{' '}</Text>
            <Text style={styles.signatureCaption}>
              {`${data.company.company_name || 'AFAMAR'}\nResponsable`}
            </Text>
          </View>
          <View style={styles.signatureCell}>
            <Text style={styles.signatureLine}>{' '}</Text>
            <Text style={styles.signatureCaption}>{'CLIENTE CONFORME\nFirma y aclaración'}</Text>
          </View>
        </View>

        {/* FOOTER */}
        {data.company.pdf_footer ? (
          <Text style={styles.footer} fixed>
            {data.company.pdf_footer}
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}
