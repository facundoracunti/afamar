/**
 * Alternative-option cards of the budget form.
 *
 * Builds one `QuoteOptionsGrid` row per material. The per-option subtotals
 * and detail lines are derived from the SAME orchestration the PDF uses
 * (`buildAlternativeSections`), so the cards can never drift from the
 * "Subtotal Opción" the PDF draws (a sole-alternatives budget revalues the
 * global zócalo/frente per option).
 */
import { useCallback, useMemo } from 'react';
import {
  buildOptionFromMaterial,
  buildDetailFromSection,
  type AlternativaLike,
} from '../../utils/budgetOptions';
import { buildAlternativeSections } from '../../utils/pdf/buildPdfData';
import type { EntityFormState, MaterialInForm } from '../../types';

interface UseBudgetQuoteOptionsParams {
  form: EntityFormState;
  /** ARS subtotal of all the previously-iterated main materials. */
  sumatoriaMaterialesPrincipalARS: number;
  /** ARS subtotal of the common fabrication extras. */
  sumatoriaAdicionalesARS: number;
}

export function useBudgetQuoteOptions({
  form,
  sumatoriaMaterialesPrincipalARS,
  sumatoriaAdicionalesARS,
}: UseBudgetQuoteOptionsParams) {
  // Build each material into a `QuoteOptionsGrid` row. Pure helper from
  // `utils/budgetOptions.ts` — same code path used to live inline.
  const buildOption = useCallback(
    (mat: MaterialInForm): AlternativaLike =>
      buildOptionFromMaterial(mat, {
        usdRate: form.usd_rate,
        sumatoriaMaterialesPrincipalARS,
        sumatoriaAdicionalesARS,
      }),
    [form.usd_rate, sumatoriaMaterialesPrincipalARS, sumatoriaAdicionalesARS],
  );

  const altSections = useMemo(
    () => buildAlternativeSections(form as unknown as Record<string, unknown>).sections
      .filter((s) => !s.is_main && !s.is_global),
    [
      JSON.stringify(form.materials_data),
      JSON.stringify(form.pools_data),
      JSON.stringify(form.fabrication_details),
      JSON.stringify(form.additional_works_data),
      form.usd_rate,
    ],
  );

  const buildAltOption = useCallback(
    (mat: MaterialInForm): AlternativaLike => {
      const card = buildOption(mat);
      const section = altSections.find((s) => s.material_name === mat.name);
      if (!section) {
        return card;
      }
      return {
        ...card,
        subtotalARS: Math.round(section.subtotal_ars * 100) / 100,
        subtotalUSD: Math.round(section.subtotal_usd * 100) / 100,
        detail: buildDetailFromSection(section),
      };
    },
    [buildOption, altSections],
  );

  return { buildOption, buildAltOption };
}
