/**
 * Modal de registro de pago de una OT — orchestrator fino.
 *
 * Toda la lógica de estado / derivación / handlers vive en
 * `usePaymentModal`; el render se reparte entre subcomponentes con
 * responsabilidad única (`PaymentAmountPresets`, `PaymentTarjetaFields`,
 * `PaymentPaywayBlock`, `PaymentUsdPanel`, `PaymentTotalsSummary`,
 * `PaymentConfirmStep`, `PaymentNotice`) y los estilos inline compartidos
 * en `PaymentModal.styles.ts`.
 */
import { createPortal } from 'react-dom';
import { usePaymentModal } from '../hooks/usePaymentModal';
import { formatCurrency, usdFromArs } from '../utils/paymentFormat';
import {
  ACTION_ROW_STYLE,
  CANCEL_BUTTON_STYLE,
  CARD_STYLE,
  OVERLAY_STYLE,
  PRIMARY_BUTTON_STYLE,
} from './PaymentModal.styles';
import { PaymentAmountPresets } from './PaymentAmountPresets';
import { PaymentConfirmStep } from './PaymentConfirmStep';
import { PaymentNotice } from './PaymentNotice';
import { PaymentPaywayBlock } from './PaymentPaywayBlock';
import { PaymentTarjetaFields } from './PaymentTarjetaFields';
import { PaymentTotalsSummary } from './PaymentTotalsSummary';
import { PaymentUsdPanel } from './PaymentUsdPanel';

export type {
  AmountPreset,
  NewPaymentTransaction,
  PaymentModalProps,
} from '../types/payment.types';

import type { PaymentModalProps } from '../types/payment.types';

export function PaymentModal(props: PaymentModalProps) {
  const m = usePaymentModal(props);
  const { isOpen, onClose, loading = false, usdRate = 0, orderNumber, clientPhone } = props;

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
            {formatCurrency(
              m.isUsdMethod ? usdFromArs(m.saldoPendiente, usdRate) : m.saldoPendiente,
              m.displayCurrency,
            )}
          </span>
        </p>

        {m.saldoPendiente <= 0 && (
          <PaymentNotice tone="success">
            No hay saldo pendiente — el cobro de esta orden está completo.
          </PaymentNotice>
        )}

        {m.confirming ? (
          <PaymentConfirmStep
            amount={m.amount}
            amountFinal={m.amountFinal}
            surchargePercent={m.surchargePercent}
            concept={m.concept}
            displayCurrency={m.displayCurrency}
            loading={loading}
            canSubmit={m.canSubmit}
            onCancel={() => m.setConfirming(false)}
            onConfirm={m.handleConfirmSubmit}
          />
        ) : (
          <form
            onSubmit={m.handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <PaymentAmountPresets
              preset={m.preset}
              onPresetChange={m.setPreset}
              customAmount={m.customAmount}
              onCustomAmountChange={m.setCustomAmount}
              seniaCumplida={m.seniaCumplida}
              remainingSeniaArs={m.remainingSeniaArs}
              saldoPendiente={m.saldoPendiente}
              isUsdMethod={m.isUsdMethod}
              usdRate={usdRate}
              displayCurrency={m.displayCurrency}
            />

            {m.method === null && (
              <PaymentNotice tone="warning">
                Seleccioná un método preferido en la tarjeta de resumen antes de registrar un pago.
              </PaymentNotice>
            )}

            {m.method === 'tarjeta' && (
              <PaymentTarjetaFields
                loteCupon={m.loteCupon}
                onLoteCuponChange={m.setLoteCupon}
                tarjetaSurchargePercent={m.tarjetaSurchargePercent}
                onTarjetaSurchargeChange={m.setTarjetaSurchargePercent}
              />
            )}

            {m.method === 'payway_link' && (
              <PaymentPaywayBlock
                paywayLinkUrl={m.paywayLinkUrl}
                paywayGenerating={m.paywayGenerating}
                orderNumber={orderNumber}
                clientPhone={clientPhone}
                onGenerate={m.handleGeneratePaywayLink}
              />
            )}

            {m.isUsdMethod && <PaymentUsdPanel amount={m.amount} usdRate={usdRate} />}

            <PaymentTotalsSummary
              amount={m.amount}
              amountFinal={m.amountFinal}
              surchargePercent={m.surchargePercent}
              displayCurrency={m.displayCurrency}
            />

            <div style={ACTION_ROW_STYLE}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  ...CANCEL_BUTTON_STYLE,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!m.canSubmit}
                style={{
                  ...PRIMARY_BUTTON_STYLE,
                  cursor: m.canSubmit ? 'pointer' : 'not-allowed',
                  opacity: m.canSubmit ? 1 : 0.5,
                }}
              >
                {loading ? 'Registrando...' : 'Registrar pago'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

export default PaymentModal;