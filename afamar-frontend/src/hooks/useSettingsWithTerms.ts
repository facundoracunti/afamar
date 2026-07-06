/**
 * Loads the global company + terms settings via `GET /api/v1/settings` and
 * splits them into the two shapes that the PDF builder expects:
 *
 *   - `company`   → header (logo, tagline, contact, footer text)
 *   - `globalTerms`→ fallback bullets when the budget/work-order has no
 *                    per-document override
 *
 * Cached by TanStack Query under `['settings']` so multiple form pages
 * mounting simultaneously share the same fetch.
 */
import { useGet } from '../api/hooks';
import { getSettings } from '../api/resources/settings';
import type { CompanyInfo, TermsInfo } from '../utils/pdf/buildPdfData';

const EMPTY_COMPANY: CompanyInfo = {
  company_name: 'AFAMAR',
  company_tagline: 'MÁRMOLES & GRANITOS',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_logo: '/uploads/logo.png',
  pdf_footer: '',
};

const EMPTY_TERMS: TermsInfo = {
  budget_terms: [],
  delivery_terms: [],
  warranty_text: [],
};

interface RawSettings {
  company_name?: string;
  company_tagline?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_logo?: string;
  pdf_footer?: string;
  budget_terms?: string[] | string;
  delivery_terms?: string[] | string;
  warranty_text?: string[] | string;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      return value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export interface SettingsWithTerms {
  company: CompanyInfo;
  globalTerms: TermsInfo;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSettingsWithTerms(): SettingsWithTerms {
  const { data, loading, error, load } = useGet<RawSettings>(
    ['settings'],
    async () => {
      const res = await getSettings();
      return (res as unknown as { data: RawSettings }).data || {};
    },
    true,
  );

  const company: CompanyInfo = {
    company_name: data?.company_name || EMPTY_COMPANY.company_name,
    company_tagline: data?.company_tagline || EMPTY_COMPANY.company_tagline,
    company_address: data?.company_address || EMPTY_COMPANY.company_address,
    company_phone: data?.company_phone || EMPTY_COMPANY.company_phone,
    company_email: data?.company_email || EMPTY_COMPANY.company_email,
    company_logo: data?.company_logo || EMPTY_COMPANY.company_logo,
    pdf_footer: data?.pdf_footer || EMPTY_COMPANY.pdf_footer,
  };

  const globalTerms: TermsInfo = {
    budget_terms: asStringList(data?.budget_terms),
    delivery_terms: asStringList(data?.delivery_terms),
    warranty_text: asStringList(data?.warranty_text),
  };

  return {
    company,
    globalTerms,
    loading,
    error: error ? String(error) : null,
    reload: load,
  };
}
