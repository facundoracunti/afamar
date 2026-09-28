import type { PdfDocumentData } from '../../../utils/pdf/buildPdfData';
import { API_URL } from '../../../api/http';

export function fmt(v: number): string {
  return (v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format the USD rate fetched-at timestamp as a short DD/MM/YYYY HH:mm
 *  string for the PDF footer. Returns an empty string if the input is
 *  unparseable so the parent can render the label without a date. */
export function formatUsdFetchedAt(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Build the absolute URL for the company logo (served from /uploads/logo.png).
 *  Falls back to no logo when company_logo is empty. */
export function logoUrl(company: PdfDocumentData['company']): string | null {
  const path = company.company_logo || '/uploads/logo.png';
  // API_URL has the form "/api/v1" — strip the trailing v1 path segment to
  // reach the same host root the uploads are served from.
  const base = API_URL.endsWith('/api/v1') ? API_URL.slice(0, -'/api/v1'.length) : '';
  if (!path) return null;
  return path.startsWith('http') ? path : `${base}${path}`;
}