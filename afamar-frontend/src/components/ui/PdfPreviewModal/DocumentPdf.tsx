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
 * This module is a thin ORCHESTRATOR — the visual sections live in
 * `./components/*` (DocumentHeader, PieceBlock, AlternativesSheet,
 * ExtrasBlock, TermsBlock…), the styles + palette in
 * `./DocumentPdf.styles.ts`, the pure helpers in `./DocumentPdf.utils.ts`
 * and the table headers/flexes + row cells in `./components/TableRows.ts`.
 *
 * NOTE: react-pdf ships a `<Font/>` registry override; embeding Helvetica
 * is unnecessary because it's a default PDF font.
 */
import React, { Fragment } from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { DocumentPdfProps } from './DocumentPdf.types';
import { styles } from './DocumentPdf.styles';
import { DocumentHeader } from './components/DocumentHeader';
import { ClientGrid, SpecsGrid } from './components/InfoGrids';
import { TermsBlock } from './components/TermsBlock';
import { OptionSectionBlock } from './components/OptionSectionBlock';
import { PieceBlock } from './components/PieceBlock';
import { AlternativesSheet } from './components/AlternativesSheet';
import { AlternativeTotalsSummary } from './components/AlternativeTotalsSummary';
import { ExtrasBlock } from './components/ExtrasBlock';
import { DataTable } from './components/Atoms';
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
} from './components/TableRows';

export default function DocumentPdf({ data }: DocumentPdfProps) {
  // Footer (auto-positioned at the bottom of every page via the `fixed` prop
  // and `position: absolute` style).
  const footer = data.company.pdf_footer ? (
    <Text style={styles.footer} fixed>
      {data.company.pdf_footer}
    </Text>
  ) : null;

  // When the budget has NO principal material (e.g. only alternatives), there
  // is no `is_main` section to host the totals/payment/signatures block. In
  // that case we render it on the FIRST alternative page so the document-level
  // totals (precio final, dólar del día, forma de pago, firmas) are still
  // visible even though every option is an alternative.
  const hasMainSection = (data.sections || []).some((s) => s.is_main);

  // Multi-piece budgets (budgets only) render the two-page pieces layout
  // instead of the legacy per-option sections.
  const pieces = data.pieces || [];
  const hasPieces = pieces.length > 0;
  const hasPieceAlternatives = pieces.some((p) => p.alternatives.length > 0);

  // Dedicated croquis page (landscape) shown for the *principal* option — the
  // same treatment in every mode so the wide editor rectángulo has room. The
  // `withHeader`/`withDivider` flags mirror the per-mode differences (pieces
  // mode omits the membrete, legacy mode omits the light divider).
  const croquisPage = (withHeader: boolean, withDivider: boolean) => (
    <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
      {withHeader ? <DocumentHeader data={data} /> : null}
      <ClientGrid data={data} />
      {withDivider ? <View style={styles.dividerLight} /> : null}
      <View style={styles.sketchBox}>
        <Text style={styles.sketchTitle}>Plano</Text>
        {data.sketch_images.map((img, i) => (
          <Image key={img.slice(0, 32) || `sketch-${i}`} style={styles.sketchImgLarge} src={img} />
        ))}
      </View>
      {footer}
    </Page>
  );

return (
    <Document title={`${data.title} ${data.number}`} author={data.company.company_name}>
      {hasPieces ? (
        <Fragment>
          {/* PAGE 1 — PRESUPUESTO/OT PRINCIPAL: one block per piece (COCINA,
              BAÑO, PARRILLA …) instead of the legacy single "PRINCIPAL"
              section. `wrap={false}` on the bottom block keeps the terms +
              totals + saldo row atomic — if it overflows page 1 the WHOLE
              block moves to page 2 as one visual unit (no orphan saldo
              box stranded alone at the bottom of page 1). */}
          <Page size="A4" style={styles.page} wrap>
            <DocumentHeader data={data} />
            <ClientGrid data={data} />
            <SpecsGrid data={data} />

            {pieces.map((piece) => (
              <PieceBlock key={piece.id || piece.name} piece={piece} />
            ))}

            {/* In pieces mode pools live INSIDE each PieceBlock — no global
                Piletas block here (otherwise the same pileta would be
                printed twice: once per piece and once at document level). */}

            <View wrap={false}>
              <TermsBlock data={data} />
              <ExtrasBlock data={data} />
              {footer}
            </View>
          </Page>

          {/* PAGE 2 — HOJA DE ALTERNATIVAS, grouped by piece. No `break`
              prop here (it was forcing a blank page between the main
              budget and the alternatives when page 1 still had room).
              Each alternative block is `wrap={false}` inside
              `AlternativesSheet`, so the flow is continuous and atomic:
              alternatives either fit at the bottom of page 1 or move
              cleanly to page 2 without intermediate blank pages. */}
          {hasPieceAlternatives ? (
            <Page size="A4" style={styles.page} wrap>
              <DocumentHeader data={data} />
              <ClientGrid data={data} />
              <Text style={styles.sectionTitle}>Hoja de alternativas</Text>
              <AlternativesSheet pieces={pieces} />
              <AlternativeTotalsSummary
                totals={data.alternative_totals || []}
                showSaldo={data.document_type === 'work_order' || data.deposit_received > 0 || data.deposit_usd > 0}
                usdRate={data.usd_rate}
                usdRateFetchedAt={data.usd_rate_fetched_at}
              />
              {footer}
            </Page>
          ) : null}

          {/* Dedicated croquis page (landscape), same treatment as the
              legacy layout so the drawing has room to breathe */}
          {data.sketch_images.length > 0 ? croquisPage(false, false) : null}
        </Fragment>
      ) : data.sections && data.sections.length > 0 ? (
        data.sections.map((section) => (
          <Fragment key={section.title}>
            <Page size="A4" style={styles.page} wrap>
              {/* HEADER — repeated on every page via the fixed component. */}
              <DocumentHeader data={data} />

              {/* CLIENT — shown on every page so each quote is self-contained */}
              <ClientGrid data={data} />

              {/* SPECS — only on the principal page (the chosen one) */}
              {section.is_main ? <SpecsGrid data={data} /> : null}

              {/* THE OPTION ITSELF — material + pools + fab + subtotal */}
              <OptionSectionBlock section={section} />

              {/* TERMS + TOTALS travel together: if they overflow page 1
                  the WHOLE atomic block moves to page 2 (no orphan saldo
                  box stranded alone at the bottom of page 1). */}
              <View wrap={false}>
                <TermsBlock data={data} />

                {section.is_main || !hasMainSection ? <ExtrasBlock data={data} section={section} /> : null}
                {footer}
              </View>
            </Page>

            {/* Dedicated croquis page — only on the principal section, only
                if there's actually a croquis to show. Same header (fixed),
                client grid and footer so the page stands on its own.
                `wrap={false}` keeps the image intact (no risk of being
                split across pages). */}
            {section.is_main && data.sketch_images.length > 0 ? croquisPage(true, true) : null}
          </Fragment>
        ))
      ) : (
        // Legacy fallback: if `sections` is missing (e.g. an old buildPdfData
        // caller), render a single page with the flat lists the way the old
        // PDF did. If there's a croquis, the dedicated-page treatment below
        // adds it on its own A4 page.
        <Fragment>
          <Page size="A4" style={styles.page} wrap>
            <DocumentHeader data={data} />
            <ClientGrid data={data} />
            <SpecsGrid data={data} />
            {data.materials.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Materiales</Text>
                <DataTable headers={MAT_HEADERS} rows={data.materials.map(matRowCells)} flexes={MAT_FLEXES} />
              </View>
            ) : null}
            {data.fabrication_details.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.sectionTitle}>Detalles de fabricación</Text>
                <DataTable headers={FAB_HEADERS} rows={data.fabrication_details.map(fabRowCells)} flexes={FAB_FLEXES} clean />
              </View>
            ) : null}
            {data.pools.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.sectionTitle}>Piletas</Text>
                <DataTable headers={POOL_HEADERS} rows={data.pools.map(poolRowCells)} flexes={POOL_FLEXES} />
              </View>
            ) : null}
            {data.additional_works && data.additional_works.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.sectionTitle}>Adicionales</Text>
                <DataTable
                  headers={ADDITIONAL_WORKS_HEADERS}
                  rows={data.additional_works.map(adicRowCells)}
                  flexes={ADDITIONAL_WORKS_FLEXES}
                  clean
                />
              </View>
            ) : null}
            {/* Final block (totals + saldo) wrapped in `wrap={false}` so it
                travels atomically to page 2 if needed. */}
            <View wrap={false}>
              <ExtrasBlock data={data} />
              <TermsBlock data={data} />
              {footer}
            </View>
          </Page>

          {/* Dedicated croquis page — only when there's something to show.
              Same fixed header + client + footer as the main page so the
              customer can extract just the croquis and still see who it's
              for. The page is rotated to landscape so the wide editor
              rectángulo has room to breathe. */}
          {data.sketch_images.length > 0 ? croquisPage(true, false) : null}
        </Fragment>
      )}
    </Document>
  );
}