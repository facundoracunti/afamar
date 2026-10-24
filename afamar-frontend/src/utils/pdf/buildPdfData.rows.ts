/**
 * The document's ROWS: materials, piletas, fabrication, additional works
 * and the per-option sections they are grouped into.
 *
 * Split out of `buildPdfData.context.ts` so "which rows does the document
 * print" lives alone, next to the rule set that values them
 * (`buildPdfData.ruleSet.ts`).
 */

import type { MaterialInForm } from '../../types/budget';
import {
  buildAdditionalWorksRows,
  buildFabricationRows,
  asMaterials,
  asPools,
  bucketAdditionalWorks,
  buildSections,
} from './buildSectionData';
import { buildPieces, piecesSubtotal } from './buildPiecesPdfData';
import { computeAdditionalWorksSubtotals } from './buildPdfData.helpers';
import { formNum } from './buildPdfData.form';
import type { AdditionalBuckets } from './buildSectionData.types';
import type {
  AdditionalWorkPdfRow,
  DocumentType,
  MaterialPdfRow,
  MaterialSection,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes';

/** Every row the document prints, already grouped. */
export interface DocumentRows {
  usdRate: number;
  allMaterials: MaterialInForm[];
  sections: MaterialSection[];
  flatMaterials: MaterialPdfRow[];
  flatPools: PoolPdfRow[];
  flatFabrication: PdfDataRow[];
  additional_works: AdditionalWorkPdfRow[];
  additionalWorksSubtotalArs: number;
  additionalWorksSubtotalUsd: number;
  adtBuckets: AdditionalBuckets;
  /** The PRINCIPAL section (undefined when the document has no main
   *  material — the alternatives carry the quote instead). */
  mainSection: MaterialSection | undefined;
  /** The synthetic GLOBAL section (only when there are no alternatives
   *  either and unassigned rows would otherwise be dropped). */
  globalSection: MaterialSection | undefined;
  /** The document subtotal the rule set runs on. */
  computedSubtotal: number;
}

/**
 * Gather the document's rows from the scenario's form slice.
 */
export function collectDocumentRows({
  form,
  effectiveForm,
  document_type,
}: {
  form: Record<string, unknown>;
  effectiveForm: Record<string, unknown>;
  document_type: DocumentType;
}): DocumentRows {
  const allMaterials = asMaterials(effectiveForm.materials_data);
  const mainMaterials = allMaterials.filter((m) => !m.is_alternative);
  const alternatives = allMaterials.filter((m) => m.is_alternative);
  const pools = asPools(effectiveForm.pools_data);
  const usdRate = formNum(form, 'usd_rate');

  const fabricationRows = buildFabricationRows(effectiveForm.fabrication_details, usdRate);

  const additional_works = buildAdditionalWorksRows(effectiveForm, usdRate);
  const {
    ars: additionalWorksSubtotalArs,
    usd: additionalWorksSubtotalUsd,
  } = computeAdditionalWorksSubtotals(additional_works);

  const adtBuckets = bucketAdditionalWorks(additional_works);

  const {
    sections,
    flatMaterials,
    flatPools,
    flatFabrication,
    subtotalMain,
    subtotalGlobal,
  } = buildSections(
    document_type === 'work_order' ? mainMaterials : allMaterials,
    document_type === 'work_order' ? [] : alternatives,
    pools,
    fabricationRows,
    usdRate,
    adtBuckets,
  );

  const mainSection = sections.find((s) => s.is_main);
  // Pieces v2: when the form carries `pieces`, the per-piece PDF is the
  // authoritative layout. The flat `buildSections` path above drops the
  // alternative materials from `mainSection.subtotal_ars` (it keeps them in
  // the alternatives sections), so trusting it would miscalculate the
  // document subtotal the moment the operator marks a material as
  // "Alternativa". The piece principal subtotals already include pools
  // (they moved into the pieces), so they sum to the true document total.
  const piecesEarly = buildPieces(effectiveForm, usdRate);
  const computedSubtotal = piecesEarly.length > 0
    ? piecesSubtotal(piecesEarly).ars
    : (mainSection ? mainSection.subtotal_ars : subtotalMain) + subtotalGlobal;

  return {
    usdRate,
    allMaterials,
    sections,
    flatMaterials,
    flatPools,
    flatFabrication,
    additional_works,
    additionalWorksSubtotalArs,
    additionalWorksSubtotalUsd,
    adtBuckets,
    mainSection,
    globalSection: sections.find((s) => s.is_global),
    computedSubtotal,
  };
}
