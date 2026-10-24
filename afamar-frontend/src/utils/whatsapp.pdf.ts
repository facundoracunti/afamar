/**
 * WhatsApp share-link builders — signed public PDF links.
 *
 * Builds the NO-AUTH PDF URL the client opens from WhatsApp, using the
 * signed token minted by `GET /api/v1/{work-orders|budgets}/{id}/public-token`.
 *
 * Kept apart from `whatsapp.links.ts` (target + public base resolution) and
 * `whatsapp.messages.ts` (message composition). `whatsapp.ts` re-exports the
 * whole public API.
 */
import { getPublicAppBaseUrl } from './whatsapp.links';

/** Document kind addressable by the public signed PDF endpoints. */
export type PublicPdfKind = 'work_order' | 'budget';

/** Builds the public (no-auth) PDF URL for a signature token minted by
 *  `GET /api/v1/{work-orders|budgets}/{id}/public-token`.
 *
 *  The tokenized URL works WITHOUT an admin login, so the WhatsApp PDF link
 *  is actually clickable by the client. `base` is a test seam (defaults to
 *  the app origin).
 */
export function buildPublicPdfUrl(
  kind: PublicPdfKind,
  token: string,
  base?: string,
): string {
  const segment = kind === 'work_order' ? 'work-orders' : 'budgets';
  const origin = getPublicAppBaseUrl(base);
  if (!origin) return '';
  return `${origin}/api/v1/public/${segment}/pdf?token=${encodeURIComponent(token)}`;
}

/** Resolves the signed public PDF URL for a live document: calls the
 *  caller-supplied `fetchToken` (must hit `…/{id}/public-token` and resolve
 *  to its unwrapped `{ token }` payload) and builds the no-auth URL.
 *
 *  Returns `''` when the token cannot be obtained (offline / missing doc) so
 *  a WhatsApp message still sends — just without the PDF link.
 */
export async function resolvePublicDocumentPdfUrl(
  kind: PublicPdfKind,
  fetchToken: () => Promise<{ data: { token?: string } }>,
  base?: string,
): Promise<string> {
  if (typeof fetchToken !== 'function') return '';
  try {
    const res = await fetchToken();
    const token = res?.data?.token;
    if (!token) return '';
    return buildPublicPdfUrl(kind, token, base);
  } catch {
    return '';
  }
}
