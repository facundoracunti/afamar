/** Pure (no React, no http) helpers for the Additional Works picker.
 *
 * Lives separately from `useAdditionalWorkSelection.ts` so unit tests can
 * import these without pulling in `api/http.ts` (which references
 * `window.APP_CONFIG` and breaks under vitest's node test environment).
 */
import { AdditionalWork, AdditionalWorkType } from '../types/additionalWork';
import { POOL_MATERIAL_GLOBAL } from '../types/budget';

export interface AdditionalWorkSelection {
  additional_work_id: number | null;
  name: string;
  detail: string | null;
  price: number;
  currency: 'ARS' | 'USD';
  quantity: number;
  total: number;
  materialName?: string;
  type: AdditionalWorkType;
  linear_meters?: number;
  assigned_material_id?: number | null;
  formula_values?: {
    material_price_m2_at_selection: number;
    /** Backend renombró el campo a `multiplier` cuando la fórmula pasó de
     *  aditiva (`+1.15`) a puramente multiplicativa (`×1.15`). Toleramos
     *  `constant` para snapshots creados por la build anterior. */
    multiplier?: number;
    constant?: number;
    computed_at: string;
  } | null;
}

function pickNumeric(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseAdditionalWorksData(json: string | null | undefined): AdditionalWorkSelection[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
        .map((row): AdditionalWorkSelection => {
          const type = (row.type === 'frente' ? 'frente' : 'flat') as AdditionalWorkType;
          const base: AdditionalWorkSelection = {
            additional_work_id:
              typeof row.additional_work_id === 'number' ? row.additional_work_id : null,
            name: typeof row.name === 'string' ? row.name : '',
            detail: typeof row.detail === 'string' ? row.detail : null,
            price: pickNumeric(row.price, 0),
            currency: row.currency === 'USD' ? 'USD' : 'ARS',
            quantity: pickNumeric(row.quantity, 1),
            total: pickNumeric(row.total, 0),
            materialName:
              typeof row.materialName === 'string' ? row.materialName : POOL_MATERIAL_GLOBAL,
            type,
          };
          if (type === 'frente') {
            const fv = row.formula_values as
              | {
                  material_price_m2_at_selection: unknown;
                  multiplier?: unknown;
                  constant?: unknown;
                  computed_at: unknown;
                }
              | undefined;
            return {
              ...base,
              linear_meters: pickNumeric(row.linear_meters, 0),
              assigned_material_id:
                row.assigned_material_id === null || row.assigned_material_id === undefined
                  ? null
                  : Number(row.assigned_material_id),
              formula_values: fv
                ? {
                    material_price_m2_at_selection: pickNumeric(
                      fv.material_price_m2_at_selection,
                      0,
                    ),
                    multiplier: pickNumeric(fv.multiplier ?? fv.constant, 0),
                    computed_at:
                      typeof fv.computed_at === 'string' ? fv.computed_at : new Date().toISOString(),
                  }
                : null,
            };
          }
          return base;
        });
    }
  } catch {
    // Treat malformed JSON as empty — the form will just show no
    // adicionales on load and the user can re-add them.
  }
  return [];
}

export function serializeAdditionalWorksData(items: AdditionalWorkSelection[]): string {
  return JSON.stringify(items);
}

export function AdditionalWorkTypeGuard(v: string): v is AdditionalWorkType {
  return v === 'flat' || v === 'frente';
}

export type _AdditionalWorkExports = AdditionalWork;
