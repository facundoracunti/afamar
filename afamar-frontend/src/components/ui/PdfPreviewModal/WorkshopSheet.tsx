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
 *
 * This file is the ORCHESTRATOR of the document: it owns the page, the logo
 * and the croquis height budget, and delegates each block to a focused
 * component (styles in `WorkshopSheet.styles.ts`).
 */
import React from 'react';
import { Document, Page, View } from '@react-pdf/renderer';
import type { WorkshopPdfData } from '../../../utils/pdf/buildWorkshopPdfData';
import { styles } from './WorkshopSheet.styles';
import { WorkshopHeader, WorkshopInfoGrid } from './WorkshopSheet.header';
import { WorkshopPoolsTable } from './WorkshopSheet.pools';
import { WorkshopSketch } from './WorkshopSheet.sketch';
import { WorkshopSpecsBlock } from './WorkshopSheet.specs';

interface WorkshopSheetProps {
  data: WorkshopPdfData;
}

export default function WorkshopSheet({ data }: WorkshopSheetProps) {
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

  return (
    <Document title={`Ficha de Taller ${data.number}`} author={data.company.company_name}>
      <Page size="A4" style={styles.page}>
        <WorkshopHeader
          company={data.company}
          number={data.number}
          date={data.date}
        />

        <View style={styles.divider} />

        <WorkshopInfoGrid materials={data.materials} clientName={data.client_name} />

        <WorkshopPoolsTable pools={data.pools} />

        <WorkshopSketch pages={data.sketch_pages} imageHeight={sketchImgHeight} />

        <WorkshopSpecsBlock specs={data.specs} observations={data.design_observations} />
      </Page>
    </Document>
  );
}
