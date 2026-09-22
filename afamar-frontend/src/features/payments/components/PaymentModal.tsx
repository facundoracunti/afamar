import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { PaymentMethod } from '../types/payment.types';
import { createPaywayCheckout } from '@/api/resources/payway';
import { useNotify } from '../../../context/NotificationContext';
import { PaywayLinkCard } from './PaywayLinkCard';

export type AmountPreset = 'suggested_seña' | 'remaining_balance' | 'custom';

export interface NewPaymentTransaction {
  method: PaymentMethod;
  /** Monto FINAL a cobrar (con recargo aplicado si es tarjeta). */
  amount: number;
  /** Monto base antes del recargo (para mostrar en el historial). */
  baseAmount?: number;
  currency: 'ARS' | 'USD';
  lote_cupon: string | null;
  payway_link_url: string | null;
  /** Recargo tarjeta en % (0 si no aplica). El modal aplica
   *  `baseAmount * (1 + recargo / 100)` para calcular `amount`. */
  tarjeta_surcharge_percent?: number;
}

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: NewPaymentTransaction) => void | Promise<void>;
  montoTotal: number;
  montoSeniaRequerida: number;
  montoPagadoAcumulado: number;
  saldoPendiente: number;
  currency?: 'ARS' | 'USD';
  /** Método por defecto del formulario. La modal NO renderiza un selector;
   *  el operador cambia la preferencia desde la tarjeta de resumen. Si el
   *  modal se abre con `null`, se muestra el aviso "Seleccioná un método
   *  preferido primero" y el botón Registrar queda deshabilitado. */
  defaultMethod?: PaymentMethod | null;
  loading?: boolean;
  /** Si ya hubo pagos previos en esta sesión (o el `montoPagadoAcumulado`
   *  es > 0), el modal abre apuntando a "Saldo restante" en vez de
   *  "Seña sugerida" — para no proponer cobrar de nuevo una seña ya
   *  cobrada. */
  hasPaymentsInSession?: boolean;
  /** Order context — required for "Link de pago" (Payway) to call the
   *  backend `/payments/payway/checkout` endpoint with a real id +
   *  number. If absent, the operator can still paste a URL manually. */
  orderId?: number | null;
  orderNumber?: string | null;
  clientName?: string | null;
  /** WhatsApp target phone (without the `+`). When set, the Payway
   *  link card shows a WhatsApp shortcut pre-filled with the URL. */
  clientPhone?: string | null;
}

const CURRENCY_FORMATTERS: Record<'ARS' | 'USD', Intl.NumberFormat> = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }),
};

function formatCurrency(value: number, currency: 'ARS' | 'USD'): string {
  return CURRENCY_FORMATTERS[currency].format(value);
}

// Estilos del overlay y del card del modal — escritos con `style` inline
// para que no dependan de Tailwind ni de un CSS module. Esto garantiza
// que el modal SIEMPRE se renderice como overlay fijo sobre `document.body`
// (portal), sin riesgo de quedar atrapado por `transform`, `overflow`,
// `contain` u otro contexto que algún ancestro haya podido crear.
const OVERLAY_STYLE = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  padding: '16px',
};

const CARD_STYLE = {
  width: '100%',
  maxWidth: '448px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '24px',
  boxShadow:
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  maxHeight: '90vh',
  overflowY: 'auto' as const,
};

// Contenedor vertical EXPLÍCITO de los radios de monto. Los estilos
// inline blindan el layout contra cualquier override de Tailwind/CSS
// module o de un `<fieldset>` (algunos browsers no aplican `flex` a
// fieldset correctamente).
const RADIO_LIST_STYLE = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px',
};

const RADIO_ROW_STYLE = {
  display: 'flex',
  alignItems: 'flex-start' as const,
  gap: '8px',
  fontSize: '14px',
  color: 'rgb(51, 65, 85)',
  cursor: 'pointer',
};

const RADIO_INPUT_STYLE = {
  marginTop: '2px',
  accentColor: '#2563eb',
  flexShrink: 0,
};

export function PaymentModal({
  isOpen,
  onClose,
  onSubmit,
  montoTotal,
  montoSeniaRequerida,
  montoPagadoAcumulado,
  saldoPendiente,
  currency = 'ARS',
  defaultMethod = null,
  loading = false,
  hasPaymentsInSession = false,
  /** Order context — required for "Link de pago" (Payway) to call
   *  the backend `/payments/payway/checkout` endpoint with a real id +
   *  number. Falls back to undefined → the operator can still paste a
   *  URL manually if no order is associated (e.g. a generic expense
   *  flow). */
  orderId,
  orderNumber,
  clientName,
  clientPhone,
}: PaymentModalProps) {
  const notify = useNotify();
  const [preset, setPreset] = useState<AmountPreset>('suggested_seña');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loteCupon, setLoteCupon] = useState<string>('');
  const [paywayLinkUrl, setPaywayLinkUrl] = useState<string | null>(null);
  const [paywayGenerating, setPaywayGenerating] = useState<boolean>(false);
  const [tarjetaSurchargePercent, setTarjetaSurchargePercent] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Política de preset por defecto al abrir:
      //   - Si ya hubo pagos previos en la sesión (o `montoPagadoAcumulado
      //     > 0`), abrimos apuntando a "Saldo restante". Esto cubre
      //     tanto "seña ya cobrada" como "seña parcialmente cobrada" —
      //     en ambos casos no tiene sentido proponer cobrar la seña
      //     de nuevo, hay que cobrar el saldo.
      //   - Si NO hubo pagos previos, arrancamos con "Seña sugerida"
      //     para que el operador cobre la seña contractual primero.
      const hayCobrosPrevios =
        hasPaymentsInSession === true || montoPagadoAcumulado > 0;
      setPreset(hayCobrosPrevios ? 'remaining_balance' : 'suggested_seña');
      setCustomAmount('');
      setLoteCupon('');
      setPaywayLinkUrl(null);
      setTarjetaSurchargePercent('');
    }
    // Solo queremos resetear al abrir/cerrar — el resto de los cambios
    // los manejan los handlers de cada input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // El método se deriva del `defaultMethod`: la modal ya no expone su
  // propio selector — el operador lo define en la tarjeta de resumen.
  const method: PaymentMethod | null = defaultMethod;

  const remainingSenia = Math.max(montoSeniaRequerida - montoPagadoAcumulado, 0);
  // Solo consideramos la seña "cumplida" cuando hay un importe sugerido
  // (>0) Y ya se pagó al menos eso. Si el operador aún no cargó una seña
  // contractual, dejamos la opción habilitada para que pueda cobrar un
  // pago parcial o personalizado.
  const seniaCumplida =
    montoSeniaRequerida > 0 && montoPagadoAcumulado >= montoSeniaRequerida;

  const amount = useMemo<number>(() => {
    if (preset === 'suggested_seña') return remainingSenia;
    if (preset === 'remaining_balance') return saldoPendiente;
    const parsed = Number(customAmount);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [preset, remainingSenia, saldoPendiente, customAmount]);

  const canSubmit = method !== null && amount > 0 && !loading;

  // Recargo tarjeta: solo aplica cuando method === 'tarjeta'. El monto
  // final = base * (1 + recargo / 100). El recargo es opcional — vacío
  // o 0 → no se aplica.
  const surchargePercentParsed = Number(tarjetaSurchargePercent);
  const surchargePercent =
    method === 'tarjeta' && Number.isFinite(surchargePercentParsed) && surchargePercentParsed > 0
      ? surchargePercentParsed
      : 0;
  const surchargeMultiplier = 1 + surchargePercent / 100;
  const amountFinal = method === 'tarjeta' ? amount * surchargeMultiplier : amount;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (method === null) return;
    if (!canSubmit) return;
    await onSubmit({
      method,
      amount: amountFinal,
      baseAmount: amount,
      currency,
      lote_cupon: method === 'tarjeta' && loteCupon.trim() !== '' ? loteCupon.trim() : null,
      payway_link_url: method === 'payway_link' ? paywayLinkUrl : null,
      tarjeta_surcharge_percent: surchargePercent,
    });
  };

  const handleGeneratePaywayLink = async (): Promise<void> => {
    if (paywayGenerating) return;
    if (!orderId || !orderNumber) {
      notify('Para generar un link de pago la operación debe estar asociada a una OT', 'error');
      return;
    }
    setPaywayGenerating(true);
    try {
      const res = await createPaywayCheckout({
        order_id: orderId,
        order_number: orderNumber,
        client_name: clientName ?? null,
        amount: amount,
        currency,
        description: `Link de pago OT ${orderNumber}`,
      });
      setPaywayLinkUrl(res.data.checkout_url);
      if (res.data.is_placeholder) {
        notify('Link generado (placeholder dev — sin credenciales Payway)', 'info');
      } else {
        notify('Link de Payway generado', 'success');
      }
    } catch (err: unknown) {
      const { parseApiError } = await import('../../../utils/error');
      notify(parseApiError(err, 'No se pudo generar el link de Payway'), 'error');
    } finally {
      setPaywayGenerating(false);
    }
  };

  if (!isOpen) return null;

  // Portal: renderizamos en `document.body` para escapar cualquier
  // `transform` / `overflow` / `contain` que un ancestro haya podido
  // crear. Eso garantiza que `position: fixed` realmente se posicione
  // contra el viewport y no quede "atrapado" dentro del card del form.
  if (typeof document === 'undefined') return null;
  const modalNode = (
    <div
      style={OVERLAY_STYLE}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div style={CARD_STYLE} onClick={(e) => e.stopPropagation()}>
        <h2
          id="payment-modal-title"
          style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'rgb(15, 23, 42)' }}
        >
          Registrar pago
        </h2>
        <p style={{ margin: '4px 0 16px', fontSize: '14px', color: 'rgb(100, 116, 139)' }}>
          Saldo pendiente:{' '}
          <span style={{ fontWeight: 500, color: 'rgb(51, 65, 85)' }}>
            {formatCurrency(saldoPendiente, currency)}
          </span>
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div>
            <p
              style={{
                margin: '0 0 12px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'rgb(51, 65, 85)',
              }}
            >
              Monto a registrar
            </p>
            <div style={RADIO_LIST_STYLE}>
              <label style={RADIO_ROW_STYLE}>
                <input
                  type="radio"
                  name="amount-preset"
                  checked={preset === 'suggested_seña'}
                  onChange={() => setPreset('suggested_seña')}
                  disabled={seniaCumplida}
                  style={RADIO_INPUT_STYLE}
                />
                <span>
                  Seña sugerida{' '}
                  <span style={{ color: 'rgb(100, 116, 139)' }}>
                    ({seniaCumplida ? 'ya completada' : formatCurrency(remainingSenia, currency)})
                  </span>
                </span>
              </label>
              <label style={RADIO_ROW_STYLE}>
                <input
                  type="radio"
                  name="amount-preset"
                  checked={preset === 'remaining_balance'}
                  onChange={() => setPreset('remaining_balance')}
                  disabled={saldoPendiente <= 0}
                  style={RADIO_INPUT_STYLE}
                />
                <span>
                  Saldo restante{' '}
                  <span style={{ color: 'rgb(100, 116, 139)' }}>
                    ({formatCurrency(saldoPendiente, currency)})
                  </span>
                </span>
              </label>
              <label style={RADIO_ROW_STYLE}>
                <input
                  type="radio"
                  name="amount-preset"
                  checked={preset === 'custom'}
                  onChange={() => setPreset('custom')}
                  style={RADIO_INPUT_STYLE}
                />
                <span>Monto personalizado</span>
              </label>
            </div>
            {preset === 'custom' && (
              <input
                type="number"
                min={0}
                step={0.01}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  marginTop: '8px',
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid rgb(203, 213, 225)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {method === null && (
            <div
              style={{
                padding: '8px 12px',
                border: '1px solid rgb(252, 211, 77)',
                backgroundColor: 'rgb(254, 243, 199)',
                color: 'rgb(146, 64, 14)',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              Seleccioná un método preferido en la tarjeta de resumen antes de registrar un pago.
            </div>
          )}

          {method === 'tarjeta' && (
            <div>
              <label
                htmlFor="lote-cupon"
                style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'rgb(51, 65, 85)',
                }}
              >
                Número de Lote / Cupón <span style={{ color: 'rgb(148, 163, 184)' }}>(opcional)</span>
              </label>
              <input
                id="lote-cupon"
                type="text"
                value={loteCupon}
                onChange={(e) => setLoteCupon(e.target.value)}
                placeholder="Ej: 123456"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid rgb(203, 213, 225)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgb(100, 116, 139)' }}>
                (Dato opcional del comprobante impreso del Posnet)
              </p>

              <label
                htmlFor="tarjeta-surcharge"
                style={{
                  display: 'block',
                  marginTop: '12px',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'rgb(51, 65, 85)',
                }}
              >
                Recargo Tarjeta (%){' '}
                <span style={{ color: 'rgb(148, 163, 184)' }}>(opcional)</span>
              </label>
              <input
                id="tarjeta-surcharge"
                type="number"
                min={0}
                step={0.5}
                value={tarjetaSurchargePercent}
                onChange={(e) => setTarjetaSurchargePercent(e.target.value)}
                placeholder="Ej: 10"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid rgb(203, 213, 225)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgb(100, 116, 139)' }}>
                Si lo dejás vacío o en 0, se cobra el monto base sin recargo.
              </p>
            </div>
          )}

          {method === 'payway_link' && (
            <div>
              {paywayLinkUrl ? (
                <PaywayLinkCard
                  url={paywayLinkUrl}
                  whatsappPhone={clientPhone}
                  whatsappTemplate={
                    orderNumber
                      ? `Hola! Te paso el link de pago para tu orden ${orderNumber}: {{url}}. Cualquier duda, avisame.`
                      : undefined
                  }
                />
              ) : (
                <button
                  type="button"
                  onClick={handleGeneratePaywayLink}
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
                  onClick={handleGeneratePaywayLink}
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
          )}

          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgb(248, 250, 252)',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          >
            <span style={{ color: 'rgb(71, 85, 105)' }}>
              {surchargePercent > 0 ? 'Total a cobrar (con recargo): ' : 'Monto a registrar: '}
            </span>
            <span style={{ fontWeight: 600, color: 'rgb(15, 23, 42)' }}>
              {formatCurrency(amountFinal, currency)}
            </span>
            {surchargePercent > 0 && (
              <span style={{ marginLeft: '8px', color: 'rgb(100, 116, 139)', fontSize: '12px' }}>
                (base {formatCurrency(amount, currency)} + {surchargePercent}%)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px',
                border: '1px solid rgb(203, 213, 225)',
                backgroundColor: '#ffffff',
                color: 'rgb(51, 65, 85)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: '8px 16px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              {loading ? 'Registrando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

export default PaymentModal;
