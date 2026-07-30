/**
 * Build a `QuoteOptionsGrid` `Alternativa` row from a `MaterialInForm`.
 *
 * Pure function — moves the per-material calculation that used to live
 * inline in `BudgetFormPage` into a reusable helper. Kept as a function
 * (not a hook) because it has no state and the same result is shared by
 * both the principal and alternative sides of the grid.
 */
import type { MaterialInForm } from '../types/budget';

export interface AlternativaLike {
  name: string;
  category: string;
  currency: string;
  costoMaterialBase: number;
  totalFinalARS: number;
  length: number;
  width: number;
  quantity: number;
}

export interface BuildOptionArgs {
  /** USD venta rate used to convert USD-priced material rows to ARS. */
  usdRate: number;
  /** Pre-computed ARS subtotal of all previously-iterated main materials.
   *  Added to the per-row cost so the option card shows the cumulative
   *  "total of the principal option" subtotal. */
  sumatoriaMaterialesPrincipalARS: number;
  /** ARS subtotal of common fabrication extras. Same purpose as above. */
  sumatoriaAdicionalesARS: number;
}

export function buildOptionFromMaterial(
  mat: MaterialInForm,
  args: BuildOptionArgs,
): AlternativaLike {
  const usdRate = Number(args.usdRate) || 1;
  const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
  const costoMat = mat.currency === 'USD' ? m2 * (mat.price_m2_usd || 0) : m2 * (mat.price_m2 || 0);
  const costoMatArs = mat.currency === 'USD' && usdRate > 0 ? costoMat * usdRate : costoMat;
  const totalFinalARS =
    args.sumatoriaMaterialesPrincipalARS + costoMatArs + args.sumatoriaAdicionalesARS;
  return {
    name: mat.name || '',
    category: mat.category || '',
    currency: mat.currency || 'ARS',
    costoMaterialBase: costoMat,
    totalFinalARS,
    length: Number(mat.length || 0),
    width: Number(mat.width || 0),
    quantity: mat.quantity || 1,
  };
}