/**
 * Bloque del "Link de pago" (Payway): si ya hay un link generado muestra el
 * `PaywayLinkCard` con acceso directo a WhatsApp; si no, el botón de generar
 * (y el "Regenerar link" debajo del card una vez generado).
 */
import { PaywayLinkCard } from './PaywayLinkCard';

interface PaymentPaywayBlockProps {
  paywayLinkUrl: string | null;
  paywayGenerating: boolean;
  orderNumber?: string | null;
  clientPhone?: string | null;
  onGenerate: () => void;
}

export function PaymentPaywayBlock({
  paywayLinkUrl,
  paywayGenerating,
  orderNumber,
  clientPhone,
  onGenerate,
}: PaymentPaywayBlockProps) {
  return (
    <div>
      {paywayLinkUrl ? (
        <PaywayLinkCard
          url={paywayLinkUrl}
          whatsappPhone={clientPhone ?? undefined}
          whatsappTemplate={
            orderNumber
              ? `Hola! Te paso el link de pago para tu orden ${orderNumber}: {{url}}. Cualquier duda, avisame.`
              : undefined
          }
        />
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={paywayGenerating}
          style={{
            width: '100%',
            padding: '8px 16px',
            border: '1px solid rgb(147, 197, 253)',
            backgroundColor: '#ffffff',
            color: 'rgb(30, 64, 175)',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: paywayGenerating ? 'wait' : 'pointer',
            opacity: paywayGenerating ? 0.7 : 1,
          }}
        >
          {paywayGenerating ? 'Generando link…' : 'Generar link de pago'}
        </button>
      )}
      {paywayLinkUrl && !paywayGenerating && (
        <button
          type="button"
          onClick={onGenerate}
          style={{
            marginTop: '6px',
            width: '100%',
            padding: '4px 8px',
            background: 'transparent',
            border: 'none',
            color: 'rgb(100, 116, 139)',
            fontSize: '11px',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Regenerar link
        </button>
      )}
    </div>
  );
}