/**
 * WhatsApp share-link builders — link/target layer.
 *
 * Owns the platform-aware WhatsApp target (`wa.me` on mobile, WhatsApp Web
 * on desktop) and the resolution of the app's PUBLIC base URL used by every
 * share link (the client opens the link on THEIR device, so a loopback
 * origin is never acceptable).
 *
 * Kept apart from `whatsapp.messages.ts` (message composition) and
 * `whatsapp.pdf.ts` (signed public PDF links) so each concern lives in one
 * place. `whatsapp.ts` re-exports the whole public API.
 */

/** Detects a phone/tablet touch device so we can pick the right
 *  WhatsApp target. `wa.me` opens the native app (property of
 *  `api.whatsapp.com`); `web.whatsapp.com/send` opens WhatsApp Web
 *  directly and skips the "Abrir aplicación / Continuar en la web"
 *  intermediate screen on desktop. */
export function isMobileDevice(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad/i.test(navigator.userAgent)
  );
}

function stripPhone(phone: string | null | undefined): string {
  return (phone || '').replace(/[^\d]/g, '');
}

/**
 * Builds the WhatsApp shortcut URL.
 *
 * - Desktop (default): `https://web.whatsapp.com/send?phone=…&text=…` opens
 *   WhatsApp Web straight into the customer's chat — no intermediate redirect.
 * - Mobile: `https://wa.me/…?text=…` opens the native WhatsApp app.
 *
 * `forceMobile` makes the device branch explicit (used by unit tests).
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
  forceMobile?: boolean,
): string {
  const cleaned = stripPhone(phone);
  const params = new URLSearchParams({ text: message });
  const mobile = forceMobile ?? isMobileDevice();
  if (mobile) {
    return cleaned
      ? `https://wa.me/${cleaned}?${params.toString()}`
      : `https://wa.me/?${params.toString()}`;
  }
  return cleaned
    ? `https://web.whatsapp.com/send?phone=${cleaned}&${params.toString()}`
    : `https://web.whatsapp.com/send?${params.toString()}`;
}

/** True when an origin is a loopback address — a WhatsApp link pointing to
 *  `localhost`/`127.0.0.1`/`::1` is useless (the client opens it on THEIR
 *  phone, never on the operator's machine). Loopback origins must never end
 *  up in a share link, so `getPublicAppBaseUrl` drops them and falls
 *  through to the next candidate. Unparseable input is treated as unsafe.
 */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '0.0.0.0' ||
      host === '::1' ||
      /^::ffff:127\./.test(host) ||
      /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
    );
  } catch {
    return true;
  }
}

/** Origin derived from `VITE_API_BASE_URL`, when that env var points at an
 *  absolute http(s) URL. In a devtunnel/ngrok setup the API base is often
 *  the only fully-public URL available (e.g.
 *  `https://87k533kf-3090.brs.devtunnels.ms/api/v1`), and its origin
 *  is exactly what a client-facing link needs. Relative API bases (Vite
 *  dev proxy, same-origin nginx) return `''` → resolution skips to the next
 *  candidate.
 */
function apiBaseOrigin(): string {
  const raw = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

/** Target base used when NO other public URL can be resolved (see
 *  `getPublicAppBaseUrl`). Keeps the WhatsApp PDF link from ever being
 *  omitted while the operator develops on localhost: this is the current
 *  public VS Code Dev Tunnel host (forwarding local port 3090 →
 *  `https://87k533kf-3090.brs.devtunnels.ms`), so a link minted here stays
 *  clickable on the client's phone. Deployment should override it via
 *  `VITE_PUBLIC_URL` (build-time) or `APP_CONFIG.PUBLIC_URL` (runtime) —
 *  both take priority over this constant. Update it when the tunnel URL
 *  changes.
 */
export const DEFAULT_PUBLIC_URL = 'https://87k533kf-3090.brs.devtunnels.ms';

/** Resolves the app's public HTTP(S) base for share links.
 *
 *  The base that ends up in a WhatsApp message must be reachable by the
 *  CLIENT (no admin login, no localhost): the client opens the link on
 *  THEIR device, so a `http://localhost:3090` (or any loopback) origin is
 *  never acceptable. Resolution order, skipping empty and loopback origins:
 *
 *   1. `base` — explicit override (test seam / shape of call sites).
 *   2. `window.APP_CONFIG.PUBLIC_URL` — runtime override (per-deployment,
 *      injected by nginx via `public/config.template.js` + envsubst). E.g.
 *      `https://87k533kf-3090.brs.devtunnels.ms`.
 *   3. `import.meta.env.VITE_PUBLIC_URL` — build-time env.
 *   4. Origin of `import.meta.env.VITE_API_BASE_URL`, when absolute http(s)
 *      (devtunnel/ngrok API base without a dedicated frontend URL).
 *   5. `window.location.origin` — when the operator opens the app THROUGH
 *      the devtunnel, this is already the public tunnel URL and requires no
 *      config at all. If it's a loopback origin (local dev without a
 *      tunnel), the guard drops it.
 *   6. `DEFAULT_PUBLIC_URL` — last-resort tunnel base, so the PDF line is
 *      NEVER omitted just because the operator runs on localhost with no
 *      env configured.
 *
 *  A trailing `/` is stripped so callers can safely append `/api/v1/…`
 *  without a double separator. Returns `''` only outside a browser with no
 *  explicit `base` (unit-test/no-op case) or if `DEFAULT_PUBLIC_URL` itself
 *  were point at a loopback — never in a real running app.
 */
export function getPublicAppBaseUrl(base?: string): string {
  if (typeof window === 'undefined' && !base) return '';
  const candidates = [
    base,
    window.APP_CONFIG?.PUBLIC_URL,
    import.meta.env?.VITE_PUBLIC_URL,
    apiBaseOrigin(),
    typeof window !== 'undefined' ? window.location.origin : undefined,
  ];
  for (const candidate of candidates) {
    if (!candidate || !candidate.trim()) continue;
    if (isLoopbackOrigin(candidate)) continue;
    return candidate.trim().replace(/\/+$/, '');
  }
  // No reachable origin configured → the PDF block would be dropped from the
  // WhatsApp message. Fall back to the known public tunnel so the link is
  // still emitted (never leaking a loopback origin).
  return isLoopbackOrigin(DEFAULT_PUBLIC_URL) ? '' : DEFAULT_PUBLIC_URL.replace(/\/+$/, '');
}

/** Ensures a URL is absolute (starts with http:// or https://).
 *
 *  The `getWorkOrderPdf`/`getBudgetPdf` helpers return the bare API path
 *  (e.g. `/api/v1/work-orders/92/pdf`); as a relative path WhatsApp does NOT
 *  render it as a clickable link. We prepend the app origin so the link in
 *  the chat is fully formed. When running outside a browser (unit tests) the
 *  caller passes an explicit `base`.
 *
 *  - `''` stays `''`.
 *  - Absolute URLs are returned untouched.
 *  - Relative URLs get `${base}` prepended (keeps their leading `/`).
 */
export function toAbsoluteUrl(
  url: string,
  base?: string,
): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = getPublicAppBaseUrl(base);
  if (!origin) return '';
  return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}
