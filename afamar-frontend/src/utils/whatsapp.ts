/**
 * WhatsApp share-link builders.
 *
 * Constructs the WhatsApp share URL the share buttons open, keeping the
 * regex-strip + URL-encode logic in ONE place (WorkOrderList, BudgetList,
 * BudgetActions, PaywayLinkCard). Also builds the standard AFAMAR
 * "we're sharing your document" greeting — with the full document summary
 * (number, materials detail, totals) and, when the order has an active
 * Payway checkout URL, the highlighted payment block at the end.
 *
 * Platform-aware target: desktop browsers open WhatsApp Web directly
 * (`https://web.whatsapp.com/send?...`, no intermediate "open the app"
 * redirect); mobile/tablet devices open the native app (`https://wa.me/...`).
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

/** One label/value row of the money summary block (Total, Seña, Saldo…). */
export interface MoneyLine {
  label: string;
  value: string;
}

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

export interface DocumentShareMessageOptions {
  clientName?: string | null;
  /** Short document label used in "Te enviamos {label} formal de AFAMAR…"
   *  (e.g. "el presupuesto", "la Orden de Trabajo"). */
  documentLabel: string;
  /** Document number (e.g. "P-000001" / "A-000090"). */
  documentNumber?: string | null;
  pdfUrl: string;
  /** Label of the "📄 Ver / Descargar {pdfLabel}:" link block (e.g.
   *  "PDF de la Orden", "PDF del Presupuesto"). Defaults to "PDF". */
  pdfLabel?: string;
  /** Optional Payway checkout URL. When present, the highlighted payment
   *  block is appended at the very end of the message. */
  paywayLink?: string | null;
  /** Bullet lines describing the main materials/items. */
  detailLines?: string[];
  /** Money rows (Total, Seña recibida, Saldo pendiente…). */
  moneyLines?: MoneyLine[];
}

/** Build the standard AFAMAR "we're sharing your document" greeting with
 *  the full document summary and, when `paywayLink` is present, the
 *  highlighted payment block at the end:
 *
 *      💳 Link de pago seguro (Payway):
 *      {paywayLink}
 *
 *      ¡Muchas gracias!
 */
export function buildDocumentShareMessage(
  opts: DocumentShareMessageOptions,
): string {
  const {
    clientName,
    documentLabel,
    documentNumber,
    pdfUrl,
    pdfLabel = 'PDF',
    paywayLink,
    detailLines = [],
    moneyLines = [],
  } = opts;

  const parts: string[] = [];
  if (clientName) parts.push(`Hola ${clientName}!`);
  parts.push(
    `Te enviamos ${documentLabel} formal de AFAMAR Mármoles & Granitos.`,
  );
  if (documentNumber) parts.push(`N° ${documentNumber}`);

  if (detailLines.length > 0) {
    parts.push(`📋 Detalle:\n${detailLines.map((d) => `• ${d}`).join('\n')}`);
  }
  if (moneyLines.length > 0) {
    parts.push(moneyLines.map((m) => `${m.label}: ${m.value}`).join('\n'));
  }

  if (pdfUrl) {
    // `getWorkOrderPdf`/`getBudgetPdf` return the bare API path; a relative
    // URL is NOT clickable in a WhatsApp chat, so absolutize it here.
    const fullPdfUrl = toAbsoluteUrl(pdfUrl);
    parts.push(`📄 Ver / Descargar ${pdfLabel}:\n${fullPdfUrl}`);
  }

  if (paywayLink) {
    parts.push(`💳 Link de pago seguro (Payway):\n${paywayLink}\n\n¡Muchas gracias!`);
  }

  return parts.join('\n\n');
}

/** Input for `buildOrderShareMessage` — a light snapshot of a Work Order
 *  (or Budget) used to compose the summary block of the WhatsApp message. */
export interface OrderShareMessageInput {
  clientName?: string | null;
  documentLabel: string;
  documentNumber?: string | null;
  pdfUrl?: string;
  pdfLabel?: string;
  paywayLink?: string | null;
  currency?: string;
  total?: number;
  depositReceived?: number;
  balanceDue?: number;
  materials?: Array<{
    name?: string;
    quantity?: number;
    length?: number;
    width?: number;
    is_alternative?: boolean;
  }>;
}

/** Convenience builder for Work Order / Budget WhatsApp messages.
 *  Formats the money rows (Total / Seña recibida / Saldo pendiente) in the
 *  entity currency and the main-materials detail lines, then delegates to
 *  `buildDocumentShareMessage` (which also appends the Payway block). */
export function buildOrderShareMessage(input: OrderShareMessageInput): string {
  const cur = input.currency === 'USD' ? 'USD' : 'ARS';
  const moneyLines: MoneyLine[] = [];

  const total = Number(input.total) || 0;
  if (total > 0) moneyLines.push({ label: 'Total', value: fmtMoney(total, cur) });

  const senia = Number(input.depositReceived) || 0;
  if (senia > 0) {
    moneyLines.push({ label: 'Seña recibida', value: fmtMoney(senia, cur) });
  }

  const saldo = Number(input.balanceDue) || 0;
  if (saldo > 0) {
    moneyLines.push({ label: 'Saldo pendiente', value: fmtMoney(saldo, cur) });
  }

  const detailLines = (input.materials || [])
    .filter((m) => !m.is_alternative)
    .map((m) => {
      const name = m.name || 'Material';
      const dims =
        m.length != null && m.width != null ? ` (${m.length}×${m.width} m)` : '';
      const qty = m.quantity ? ` ×${m.quantity}` : '';
      return `${name}${qty}${dims}`;
    });

  return buildDocumentShareMessage({
    clientName: input.clientName,
    documentLabel: input.documentLabel,
    documentNumber: input.documentNumber,
    pdfUrl: input.pdfUrl || '',
    pdfLabel: input.pdfLabel || 'PDF de la Orden',
    paywayLink: input.paywayLink,
    detailLines,
    moneyLines,
  });
}

function fmtMoney(value: number, currency: 'ARS' | 'USD'): string {
  const symbol = currency === 'USD' ? 'US$' : '$';
  return `${symbol} ${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)}`;
}