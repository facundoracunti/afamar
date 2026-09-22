import { useCallback, useState } from 'react';
import { PaymentModal } from '../../payments/components/PaymentModal';
import type { NewPaymentTransaction } from '../../payments/components/PaymentModal';
import { OrderPaymentSummary } from './OrderPaymentSummary';
import { usePaymentAction } from '../../payments/hooks/usePaymentAction';
import type { RegisteredPayment } from '../../payments/hooks/usePaymentAction';
import type { PaymentMethod } from '../../payments/types/payment.types';
import { useNotify } from '../../../context/NotificationContext';

const BACKEND_TO_MODULE: Record<string, PaymentMethod> = {
  EFECTIVO: 'efectivo',
  'TRANSFERENCIA BANCARIA': 'transferencia',
  'TARJETA DE DÉBITO': 'tarjeta',
  'TARJETA DE CRÉDITO': 'payway_link',
};

const MODULE_TO_BACKEND: Record<PaymentMethod, string> = {
  efectivo: 'EFECTIVO',
  transferencia: 'TRANSFERENCIA BANCARIA',
  tarjeta: 'TARJETA DE DÉBITO',
  payway_link: 'TARJETA DE CRÉDITO',
};

export function resolvePreferredMethod(backendName: string | null | undefined): PaymentMethod | null {
  if (!backendName) return null;
  return BACKEND_TO_MODULE[backendName] ?? null;
}

export function backendMethodFor(method: PaymentMethod | null): string | null {
  if (!method) return null;
  return MODULE_TO_BACKEND[method] ?? null;
}

export interface WorkOrderPaymentSectionProps {
  orderId: number | null;
  orderNumber: string | null;
  clientName: string | null;
  /** WhatsApp target (sin `+`) — habilita el botón WhatsApp en el link de Payway. */
  clientPhone?: string | null;
  montoTotal: number;
  montoSeniaRequerida: number;
  montoPagadoAcumulado: number;
  preferredMethodBackend: string | null;
  currency: 'ARS' | 'USD';
  /** Persistir la preferencia en el form (no marca la OT como pagada). */
  onPreferredMethodChange: (method: PaymentMethod | null) => void;
  /** Mensajes opcionales que el operador ve tras registrar / fallar. */
  successMessage?: string;
  errorMessage?: string;
}

export function WorkOrderPaymentSection(props: WorkOrderPaymentSectionProps) {
  const notify = useNotify();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const preferredMethod = resolvePreferredMethod(props.preferredMethodBackend);

  const { breakdown, isRegistering, registerPayment, registeredTransactions } = usePaymentAction({
    orderId: props.orderId,
    orderNumber: props.orderNumber,
    clientName: props.clientName,
    montoTotal: props.montoTotal,
    montoPagadoAcumulado: props.montoPagadoAcumulado,
    montoSeniaRequerida: props.montoSeniaRequerida,
    preferredMethod,
  });

  const handlePaymentSubmit = useCallback(
    async (tx: NewPaymentTransaction) => {
      try {
        await registerPayment(tx);
        setIsModalOpen(false);
        notify(props.successMessage ?? 'Pago registrado correctamente', 'success');
      } catch {
        notify(props.errorMessage ?? 'No se pudo registrar el pago', 'error');
      }
    },
    [registerPayment, notify, props.successMessage, props.errorMessage],
  );

  const handlePreferredMethodChange = useCallback(
    (method: PaymentMethod) => {
      props.onPreferredMethodChange(method);
    },
    [props],
  );

  const isReadOnly = props.orderId === null;

  return (
    <div className="space-y-4">
      <OrderPaymentSummary
        montoTotal={breakdown.monto_total}
        montoSeniaRequerida={breakdown.monto_senia_requerida}
        montoPagadoAcumulado={breakdown.monto_pagado_acumulado}
        saldoPendiente={breakdown.saldo_pendiente}
        status={breakdown.status}
        preferredMethod={breakdown.preferred_method}
        currency={props.currency}
        onRegisterPayment={isReadOnly ? undefined : () => setIsModalOpen(true)}
        onPreferredMethodChange={handlePreferredMethodChange}
        paymentHistory={registeredTransactions}
        clientPhone={props.clientPhone}
      />

      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handlePaymentSubmit}
        montoTotal={breakdown.monto_total}
        montoSeniaRequerida={breakdown.monto_senia_requerida}
        montoPagadoAcumulado={breakdown.monto_pagado_acumulado}
        saldoPendiente={breakdown.saldo_pendiente}
        currency={props.currency}
        defaultMethod={breakdown.preferred_method}
        loading={isRegistering}
        hasPaymentsInSession={registeredTransactions.length > 0}
        orderId={props.orderId}
        orderNumber={props.orderNumber}
        clientName={props.clientName}
        clientPhone={props.clientPhone}
      />
    </div>
  );
}

export default WorkOrderPaymentSection;
