/**
 * COMPARATIVA DE MEDICIÓN — legacy flat-array resolution.
 *
 * Extracted from `buildSectionData.measurement.ts` (which stays the public
 * orchestrator). Resolves the "rendering pieces" the COMPARATIVA DE MEDICIÓN
 * should iterate over. The form may carry:
 *
 *   (a) `form.pieces` already populated (modern WO), or
 *   (b) only the legacy flat arrays (`materials_data` /
 *       `fabrication_details` / `additional_works_data`) — the case of an
 *       API response without `pieces_data` or a test fixture that only
 *       sets the legacy fields.
 *
 * Case (b) is folded into a single piece named "PRINCIPAL" so the
 * comparativa still renders the existing flat data — without the per-
 * piece grouping but with the new filtering + duplicate-annotation
 * behaviour. This is the safe default: tests + legacy imports keep
 * working unchanged; modern WOs get the new per-piece rendering.
 */

import type {
  BudgetPiece,
  FabricationDetail,
  MaterialInForm,
} from '../../types/budget';

function legacyAdditionalWorksFromString(raw: unknown): Array<Record<string, unknown>> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function legacyMaterialsFromRaw(raw: unknown): MaterialInForm[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as MaterialInForm[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as MaterialInForm[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function resolveRenderingPieces(
  form: { pieces?: unknown; materials_data?: unknown; fabrication_details?: unknown; additional_works_data?: unknown },
): BudgetPiece[] {
  const pieces = (form.pieces as BudgetPiece[] | undefined) ?? [];
  const hasUsablePiece = pieces.some((p) =>
    p.mainMaterial
    || (p.mainMaterialRows?.length ?? 0) > 0
    || (p.fabrication_details?.length ?? 0) > 0
    || (() => {
      if (!p.additional_works_data) return false;
      try {
        const arr = JSON.parse(p.additional_works_data);
        return Array.isArray(arr) && arr.length > 0;
      } catch { return false; }
    })(),
  );
  if (hasUsablePiece) return pieces;
  // Fallback: fold the legacy flat arrays into a single piece so the
  // comparativa still has data to work with. Without this, a form
  // constructed by older test fixtures would render an empty table.
  const flatMaterials = legacyMaterialsFromRaw(form.materials_data);
  const mainMaterials = flatMaterials.filter((m) => !m.is_alternative);
  const altMaterials = flatMaterials.filter((m) => m.is_alternative);
  const fabDetails = (Array.isArray(form.fabrication_details)
    ? form.fabrication_details
    : []) as FabricationDetail[];
  const adicionales = legacyAdditionalWorksFromString(form.additional_works_data);
  // If there's no legacy data either, return the empty pieces list as-is.
  if (
    mainMaterials.length === 0
    && altMaterials.length === 0
    && fabDetails.length === 0
    && adicionales.length === 0
  ) {
    return pieces;
  }
  return [
    {
      id: 'legacy-folded',
      name: 'PRINCIPAL',
      mainMaterial: mainMaterials[0] ?? null,
      mainMaterialRows: mainMaterials.slice(1),
      alternativeMaterials: altMaterials,
      fabrication_details: fabDetails,
      additional_works_data: JSON.stringify(adicionales),
      pools: [],
    },
  ];
}
