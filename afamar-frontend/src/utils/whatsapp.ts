/**
 * WhatsApp share-link builder.
 *
 * Constructs the `https://api.whatsapp.com/send?phone=…&text=…` URL the
 * `wa.me` button opens. Centralises the regex-strip + URL-encode that
 * used to be inlined in three places (BudgetActions, WorkOrderList,
 * BudgetList) so the format stays consistent.
 */

function stripPhone(phone: string | null | undefined): string {
  return (phone || '').replace(/[^\d]/g, '');
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const cleaned = stripPhone(phone);
  const encoded = encodeURIComponent(message);
  return cleaned
    ? `https://api.whatsapp.com/send?phone=${cleaned}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
}

/** Build the standard AFAMAR "we're sharing your document" greeting. */
export function buildDocumentShareMessage(opts: {
  clientName?: string | null;
  documentLabel: string;
  pdfUrl: string;
}): string {
  const saludo = opts.clientName ? `Hola ${opts.clientName}! ` : '';
  return `${saludo}Te enviamos ${opts.documentLabel} formal de AFAMAR Mármoles & Granitos. Podés revisarlo e imprimirlo desde el siguiente link: ${opts.pdfUrl}`;
}