/**
 * PaywayLinkCard — displays a generated checkout URL with Copy and
 * WhatsApp actions. Rendered inside the work-order payment summary
 * ("Resumen de cobro") whenever there's a payment with a link, and
 * inside the cash movement modal right after the operator clicks
 * "Generar link".
 *
 * All visual decisions are inline styles to match the rest of the
 * payments module (which already uses inline styles — see
 * `PaymentModal.tsx`).
 */
import { useState, useCallback } from 'react';
import { buildWhatsAppUrl } from '../../../utils/whatsapp';

export interface PaywayLinkCardProps {
  url: string;
  /** Optional WhatsApp target phone number (without the `+`). When set
   *  and a non-zero whatsapp link is shown, the operator can hit one
   *  button and the customer's chat opens with the URL pre-filled. */
  whatsappPhone?: string | null;
  /** Default message sent to WhatsApp. `{{url}}` is replaced with the
   *  checkout URL. */
  whatsappTemplate?: string;
  /** Optional label / sub-label for the card header. */
  label?: string;
  /** When true, shows a "Copied!" flash on the Copy button. */
  showCopyFeedback?: boolean;
}

const DEFAULT_WHATSAPP_TEMPLATE =
  'Hola! Te paso el link de pago para tu orden: {{url}}. Cualquier duda, avisame.';

/**
 * Builds the WhatsApp shortcut URL via the shared `utils/whatsapp`
 * helper (desktop → `web.whatsapp.com/send`, mobile → `wa.me`). Kept as a
 * thin wrapper so this module's call sites stay untouched if the shared
 * builder evolves.
 */
function buildPaywayWhatsappUrl(
  phone: string | null | undefined,
  message: string,
): string {
  return buildWhatsAppUrl(phone, message);
}

export function PaywayLinkCard({
  url,
  whatsappPhone,
  whatsappTemplate,
  label = 'Link de pago (Payway)',
  showCopyFeedback = true,
}: PaywayLinkCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts (jsdom, older browsers).
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Silent: the operator can still copy manually.
    }
  }, [url]);

  const message = (whatsappTemplate ?? DEFAULT_WHATSAPP_TEMPLATE).replace(
    '{{url}}',
    url,
  );
  const whatsappUrl = buildPaywayWhatsappUrl(whatsappPhone, message);

  return (
    <div
      data-testid="payway-link-card"
      style={{
        marginTop: '12px',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid rgb(187, 247, 208)',
        backgroundColor: 'rgb(240, 253, 244)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'rgb(22, 101, 52)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          🔗 {label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <input
          type="text"
          readOnly
          value={url}
          aria-label="URL del link de pago"
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            backgroundColor: '#ffffff',
            border: '1px solid rgb(187, 247, 208)',
            borderRadius: '6px',
            color: 'rgb(20, 83, 45)',
          }}
        />
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar link de pago"
          title="Copiar"
          style={{
            padding: '0 12px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: copied ? 'rgb(22, 163, 74)' : 'rgb(34, 197, 94)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background-color 120ms ease',
          }}
        >
          {copied && showCopyFeedback ? '✓ Copiado' : 'Copiar'}
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Enviar link por WhatsApp"
          title={whatsappPhone ? `Enviar a +${whatsappPhone}` : 'Abrir WhatsApp'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 12px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: 'rgb(37, 211, 102)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span aria-hidden="true">📱</span> WhatsApp
        </a>
      </div>
    </div>
  );
}

export default PaywayLinkCard;
