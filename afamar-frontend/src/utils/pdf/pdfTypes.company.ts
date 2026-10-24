/**
 * PDF data types — EMPRESA / TÉRMINOS domain.
 *
 * Extracted from `pdfTypes.ts` (which stays the public barrel). The company
 * block printed in the header and the commercial terms printed at the
 * bottom of the document.
 */

export interface CompanyInfo {
  company_name: string;
  company_tagline: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo: string;
  pdf_footer: string;
  /** Free-text "válido por X días" line. Optional: when undefined/empty the
   *  PDF header omits the line entirely (budget-only). */
  budget_validity_text?: string;
}

export interface TermsInfo {
  budget_terms: string[];
  delivery_terms: string[];
  warranty_text: string[];
}
