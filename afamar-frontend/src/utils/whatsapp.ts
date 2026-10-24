/**
 * WhatsApp share-link builders (public entry point).
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
 *
 * This file is a thin BARREL (see ADR 0009): the implementation lives in
 * three focused sub-modules and is re-exported here so every consumer keeps
 * importing from `utils/whatsapp` exactly as before.
 *
 *  - `whatsapp.links.ts`  — WhatsApp target + public base URL resolution.
 *  - `whatsapp.pdf.ts`    — signed public (no-auth) PDF links.
 *  - `whatsapp.messages.ts` — message composition (greeting + summary).
 */

export {
  isMobileDevice,
  buildWhatsAppUrl,
  isLoopbackOrigin,
  DEFAULT_PUBLIC_URL,
  getPublicAppBaseUrl,
  toAbsoluteUrl,
} from './whatsapp.links';

export {
  buildPublicPdfUrl,
  resolvePublicDocumentPdfUrl,
} from './whatsapp.pdf';
export type { PublicPdfKind } from './whatsapp.pdf';

export {
  buildDocumentShareMessage,
  buildOrderShareMessage,
} from './whatsapp.messages';
export type {
  MoneyLine,
  DocumentShareMessageOptions,
  OrderShareMessageInput,
} from './whatsapp.messages';
