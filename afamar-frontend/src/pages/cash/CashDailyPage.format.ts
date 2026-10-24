/**
 * `CashDailyPage` — small formatters shared by the page and its
 * print-only blocks.
 */

/** Formats an ISO timestamp as `dd/mm/aaaa hh:mm` (es-AR). */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}
