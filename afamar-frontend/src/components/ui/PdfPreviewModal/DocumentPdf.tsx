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
import type { PdfDocumentData, MaterialSection } from '../../../utils/pdf/buildPdfData';
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
  // ===== OPTION SECTION BLOCK (per-material breakdown) =====
  // Each section is a self-contained card with its own tables + subtotal so
  // the reader can see "PRINCIPAL: GRIS MARA" / "ALTERNATIVA 1: TAJ MAHAL" as
  // independent quotes (the customer only executes one).
  optSectionBlock: { marginTop: 8, marginBottom: 4, padding: 6, border: `1px solid ${SLATE_200}`, borderRadius: 4 },
  optSectionBlockMain: { borderColor: HEADER_RED, backgroundColor: '#fef9f9' },
  optSectionBlockAlt: { borderColor: SLATE_400, backgroundColor: SLATE_50 },
  optSectionTitle: { fontSize: 10, fontWeight: 'bold', color: HEADER_RED, textTransform: 'uppercase', marginBottom: 4, paddingBottom: 2, borderBottom: `1px solid ${HEADER_RED}` },
  optSectionTitleAlt: { color: SLATE_700, borderBottomColor: SLATE_400 },
  optSectionSubtotal: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, paddingTop: 3, borderTop: `1px dashed ${SLATE_200}` },
  optSectionSubtotalLbl: { fontSize: 8, fontWeight: 'bold', color: SLATE_700, marginRight: 8 },
  optSectionSubtotalVal: { fontSize: 9, fontWeight: 'bold', color: HEADER_RED },
  optSectionSubtotalUsd: { fontSize: 8, color: BLUE_700, marginLeft: 6 },
  // ===== SECTION TITLE =====
  // ===== CROQUIS =====
  // The sketch image is a 800×600px PNG extracted from the same fixed
  // stage as the editor (see `components/sketch/constants.ts`). 4:3
  // aspect ratio. The PDF renders it at SKETCH_PDF_WIDTH ×
  // SKETCH_PDF_HEIGHT (preserving the aspect ratio) inside a light box.
  // This size was picked so the sketch is large enough to read every
  // detail in print (a 4:3 canvas maps to ~340×255pt which is
  // roughly half a page wide) without pushing the other content off
  // the page.
  sketchBox: { backgroundColor: SLATE_50, border: `1px solid ${SLATE_200}`, padding: 6, marginBottom: 8 },
  sketchTitle: { fontSize: 8, fontWeight: 'bold', color: SLATE_700, textTransform: 'uppercase', marginBottom: 2 },
  sketchImg: { width: 340, height: 255, objectFit: 'contain', marginVertical: 4 },
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

// ===== Option section: one self-contained block per material/alternative =====
//
// Each block is rendered as a card with a colored border (red = principal,
// gray = alternative) and includes its own material / pool / fabrication
// tables + subtotal. The common "Extras / Global" fabrication details and
// global pools are folded into every section's rows, so each option shows
// its full price at a glance. Alternatives are quoted but their subtotals
// do NOT add into the document grand total — the customer only executes
// one of them.

const FAB_HEADERS = [
  { label: 'Concepto' },
  { label: 'Detalle' },
  { label: 'Material' },
  { label: 'Largo', num: true },
  { label: 'Ancho', num: true },
  { label: 'M²/Cant', num: true },
  { label: 'Precio', num: true },
  { label: 'Mano de obra', num: true },
  { label: 'Moneda' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
const FAB_FLEXES = [1.8, 1.8, 1.4, 0.8, 0.8, 0.9, 0.9, 0.9, 0.7, 1.1, 1.1];

const MAT_HEADERS = [
  { label: 'Material' },
  { label: 'Color' },
  { label: 'Largo', num: true },
  { label: 'Ancho', num: true },
  { label: 'Cant.', num: true },
  { label: 'M²', num: true },
  { label: 'Precio/m²', num: true },
  { label: 'Moneda' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
const MAT_FLEXES = [2, 1.2, 1, 1, 0.6, 0.8, 1, 0.6, 1.2, 1.2];

const POOL_HEADERS = [
  { label: 'Marca' },
  { label: 'Modelo' },
  { label: 'Cant.', num: true },
  { label: 'Precio', num: true },
  { label: 'Moneda' },
  { label: 'Subtotal ARS', num: true },
  { label: 'Subtotal USD', num: true },
];
const POOL_FLEXES = [1.5, 1.5, 0.6, 1, 0.6, 1.2, 1.2];

function fabRowCells(d: import('../../../utils/pdf/buildPdfData').PdfDataRow): (string | null)[] {
  return [
    d.concept,
    d.detail,
    d.material,
    d.show_length && d.length_str ? d.length_str : null,
    d.show_width && d.width_str ? d.width_str : null,
    d.show_m2 ? d.m2_label : d.show_quantity ? String(d.quantity) : null,
    `$ ${d.price_str}`,
    d.labor_str ? `$ ${d.labor_str}` : null,
    d.currency,
    d.subtotal_ars > 0 ? `$ ${fmt(d.subtotal_ars)}` : null,
    d.subtotal_usd > 0 ? `USD ${fmt(d.subtotal_usd)}` : null,
  ];
}

function matRowCells(m: import('../../../utils/pdf/buildPdfData').MaterialPdfRow): (string | null)[] {
  return [
    m.name,
    m.color,
    m.length_str,
    m.width_str,
    String(m.quantity),
    m.m2_str,
    `$ ${m.price_m2_str}`,
    m.currency,
    m.subtotal_ars > 0 ? `$ ${fmt(m.subtotal_ars)}` : null,
    m.subtotal_usd > 0 ? `USD ${fmt(m.subtotal_usd)}` : null,
  ];
}

function poolRowCells(p: import('../../../utils/pdf/buildPdfData').PoolPdfRow): (string | null)[] {
  return [
    p.brand,
    p.model,
    String(p.quantity),
    `$ ${p.price_str}`,
    p.currency,
    p.subtotal_ars > 0 ? `$ ${fmt(p.subtotal_ars)}` : null,
    p.subtotal_usd > 0 ? `USD ${fmt(p.subtotal_usd)}` : null,
  ];
}

function OptionSectionBlock({ section }: { section: MaterialSection }) {
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

  const hasContent =
    fabRows.length > 0 || matRows.length > 0 || poolRows.length > 0;
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
          <DataTable headers={FAB_HEADERS} rows={fabRows} flexes={FAB_FLEXES} />
        </View>
      ) : null}

      {poolRows.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <DataTable headers={POOL_HEADERS} rows={poolRows} flexes={POOL_FLEXES} />
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
      <InfoCell label="Correo" value={data.client_email} />
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

  // The old flat fabrication/materials/pools headers + rows are now module-
  // level constants + helpers (FAB_HEADERS, MAT_HEADERS, POOL_HEADERS, fabRowCells,
  // matRowCells, poolRowCells) because each OptionSectionBlock now builds its
  // own rows from `data.sections[*]`.

  // Per-page terms (rendered on every page so each option quote is
  // self-contained with its own header/terms/footer).
  const termsBlock = data.document_type === 'budget' ? (
    <>
      <TermsList title="Términos del presupuesto" items={data.budget_terms_list} />
      <TermsList title="Garantía" items={data.warranty_terms_list} />
    </>
  ) : (
    <>
      <TermsList title="Condiciones de entrega" items={data.delivery_terms_list} />
      <TermsList title="Garantía" items={data.warranty_terms_list} />
    </>
  );

  // Document-level totals + payment + signatures — only on the principal
  // page (where the customer signs the chosen option).
  const principalExtras = (
    <>
      {/* OBSERVATIONS — only on principal page */}
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
        {data.surcharge_percentage > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLbl}>{`Recargo (${data.surcharge_percentage}%)`}</Text>
            <Text style={styles.totalsVal}>{`+ $ ${fmt(data.surcharge_amount)}`}</Text>
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
              <Text>
                {` (${data.installments} cuotas`}
                {data.surcharge_percentage > 0
                  ? ` con ${data.surcharge_percentage}% de interés`
                  : ''}
                {')'}
              </Text>
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
    </>
  );

  // Footer (auto-positioned at the bottom of every page via the `fixed` prop
  // and `position: absolute` style).
  const footer = data.company.pdf_footer ? (
    <Text style={styles.footer} fixed>
      {data.company.pdf_footer}
    </Text>
  ) : null;

  return (
    <Document title={`${data.title} ${data.number}`} author={data.company.company_name}>
      {data.sections && data.sections.length > 0 ? (
        // ONE PAGE PER OPTION — each section (Principal + each Alternative)
        // gets its own A4 page with header / terms / footer so the customer
        // can extract any option and have a complete self-contained quote.
        data.sections.map((section) => (
          <Page key={section.title} size="A4" style={styles.page} wrap>
            {/* HEADER */}
            {headerLeftRight}
            <View style={styles.divider} />

            {/* CLIENT — shown on every page so each quote is self-contained */}
            {clientGrid}
            <View style={styles.dividerLight} />

            {/* SPECS + CROQUIS — only on the principal page (the chosen one) */}
            {section.is_main ? (
              <>
                {specsGrid}
                {data.sketch_images.length > 0 ? (
                  <View style={styles.sketchBox}>
                    <Text style={styles.sketchTitle}>Croquis</Text>
                    {data.sketch_images.map((img, i) => (
                      <Image key={i} style={styles.sketchImg} src={img} />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {/* THE OPTION ITSELF — material + pools + fab + subtotal */}
            <OptionSectionBlock section={section} />

            {/* TERMS — on every page (per user request: each option quote is
                self-contained with its own terms block) */}
            {termsBlock}

            {/* TOTALS / PAYMENT / SIGNATURES — only on the principal page */}
            {section.is_main ? principalExtras : null}

            {/* FOOTER — `fixed` makes it appear on every page automatically */}
            {footer}
          </Page>
        ))
      ) : (
        // Legacy fallback: if `sections` is missing (e.g. an old buildPdfData
        // caller), render a single page with the flat lists the way the old
        // PDF did.
        <Page size="A4" style={styles.page} wrap>
          {headerLeftRight}
          <View style={styles.divider} />
          {clientGrid}
          <View style={styles.dividerLight} />
          {specsGrid}
          {data.sketch_images.length > 0 ? (
            <View style={styles.sketchBox}>
              <Text style={styles.sketchTitle}>Croquis</Text>
              {data.sketch_images.map((img, i) => (
                <Image key={i} style={styles.sketchImg} src={img} />
              ))}
            </View>
          ) : null}
          {data.materials.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>Materiales</Text>
              <DataTable headers={MAT_HEADERS} rows={data.materials.map(matRowCells)} flexes={MAT_FLEXES} />
            </View>
          ) : null}
          {data.fabrication_details.length > 0 ? (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.sectionTitle}>Detalles de fabricación</Text>
              <DataTable headers={FAB_HEADERS} rows={data.fabrication_details.map(fabRowCells)} flexes={FAB_FLEXES} />
            </View>
          ) : null}
          {data.pools.length > 0 ? (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.sectionTitle}>Piletas</Text>
              <DataTable headers={POOL_HEADERS} rows={data.pools.map(poolRowCells)} flexes={POOL_FLEXES} />
            </View>
          ) : null}
          {principalExtras}
          {termsBlock}
          {footer}
        </Page>
      )}
    </Document>
  );
}
