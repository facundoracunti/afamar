/**
 * WhatsApp share-link builders — message composition.
 *
 * Builds the standard AFAMAR "we're sharing your document" greeting — with
 * the full document summary (number, materials detail, totals) and, when the
 * order has an active Payway checkout URL, the highlighted payment block at
 * the end.
 *
 * Kept apart from `whatsapp.links.ts` (target + public base resolution) and
 * `whatsapp.pdf.ts` (signed public PDF links). `whatsapp.ts` re-exports the
 * whole public API.
 */
import { toAbsoluteUrl } from './whatsapp.links';

/** One label/value row of the money summary block (Total, Seña, Saldo…). */
export interface MoneyLine {
  label: string;
  value: string;
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
