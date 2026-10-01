/**
 * Paso 2 del registro: pantalla de confirmación explícita. Muestra el monto
 * final a cobrar y el concepto elegido; el botón "Sí, registrar pago" recién
 * acá dispara el `onSubmit`. Si el POST falla, el padre vuelve al paso de
 * edición (ver `usePaymentModal.handleConfirmSubmit`).
 */
import { ACTION_ROW_STYLE, CANCEL_BUTTON_STYLE, PRIMARY_BUTTON_STYLE } from './PaymentModal.styles';
import { formatCurrency } from '../utils/paymentFormat';
import type { PaymentConcept } from '../types/payment.types';

interface PaymentConfirmStepProps {
  amount: number;
  amountFinal: number;
  surchargePercent: number;
  concept: PaymentConcept;
  displayCurrency: 'ARS' | 'USD';
  loading: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PaymentConfirmStep({
  amount,
  amountFinal,
  surchargePercent,
  concept,
  displayCurrency,
  loading,
  canSubmit,
  onCancel,
  onConfirm,
}: PaymentConfirmStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'rgb(51, 65, 85)' }}>
        ¿Confirmás el registro de pago de{' '}
        <strong>{formatCurrency(amountFinal, displayCurrency)}</strong> bajo el concepto de{' '}
        <strong>{concept}</strong>?
      </p>
      {surchargePercent > 0 && (
        <p style={{ margin: 0, fontSize: '13px', color: 'rgb(100, 116, 139)' }}>
          Incluye el recargo de {surchargePercent}% sobre{' '}
          {formatCurrency(amount, displayCurrency)}.
        </p>
      )}
      <div style={ACTION_ROW_STYLE}>
        <button
          type="button"
          onClick={onCancel}
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
          type="button"
          onClick={onConfirm}
          disabled={!canSubmit || loading}
          style={{
            ...PRIMARY_BUTTON_STYLE,
            cursor: !canSubmit || loading ? 'not-allowed' : 'pointer',
            opacity: !canSubmit || loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Registrando...' : 'Sí, registrar pago'}
        </button>
      </div>
    </div>
  );
}