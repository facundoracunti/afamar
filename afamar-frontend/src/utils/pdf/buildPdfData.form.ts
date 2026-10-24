/**
 * Form accessors for the PDF payload builders.
 *
 * The PDF builders read the `EntityFormState` snapshot through two tiny
 * coercions: a STRING field (missing → `''`) and a NUMBER field (missing /
 * non-numeric → `0`). They live here so the document builder and the
 * context builder share ONE definition of "how a raw form value is read".
 */

/** Read a string field from the form (missing / null → `''`). */
export function formStr(form: Record<string, unknown>, key: string): string {
  return (form[key] as string | null | undefined) ?? '';
}

/** Read a numeric field from the form (missing / non-numeric → `0`). */
export function formNum(form: Record<string, unknown>, key: string): number {
  return Number(form[key]) || 0;
}
