/**
 * Payment section of the work order form.
 *
 * Wraps `<WorkOrderPaymentSection>` (the native payments module) with the
 * data it needs from the form: the suggested deposit, the preferred
 * payment method and the live total of the registered payments.
 */
import React from 'react';
import WorkOrderPaymentSection, { backendMethodFor } from '../../features/orders/components/WorkOrderPaymentSection';
import type { PaymentMethod } from '../../features/payments/types/payment.types';
import type { EntityFormState } from '../../types';

interface WorkOrderFormPagePaymentSectionProps {
  /** Id of the saved order (`null` while creating). */
  orderId: number | null;
  form: EntityFormState;
  update: (field: string, value: unknown) => void;
  /** Live accumulated amount of the payments registered in the session. */
  onPaidChange: (paid: number) => void;
  isAdmin: boolean;
}

export default function WorkOrderFormPagePaymentSection({
  orderId,
  form,
  update,
  onPaidChange,
  isAdmin,
}: WorkOrderFormPagePaymentSectionProps) {
  const montoSeniaRequerida = (() => {
    const seniaGuardada = form.deposit_received ?? 0;
    const totalPositivo = form.total > 0;
    // Umbral 95%: si `deposit_received` está al 95% o más del
    // total, lo tratamos como "se guardó el total" (típico
    // de OTs legacy donde `deposit_received` se usaba como
    // pago total, o de operadores que copiaron el total
    // por error) y recalculamos al 50%.
    const seniaEsCustom =
      totalPositivo &&
      seniaGuardada > 0 &&
      seniaGuardada < form.total * 0.95;
    return seniaEsCustom
      ? seniaGuardada
      : Math.round(form.total * 50) / 100;
  })();

  return (
    <WorkOrderPaymentSection
      orderId={orderId}
      orderNumber={form.number ?? null}
      clientName={form.client_name ?? null}
      clientPhone={form.client_phone ?? null}
      montoTotal={form.total}
      montoSeniaRequerida={montoSeniaRequerida}
      montoPagadoAcumulado={0}
      preferredMethodBackend={form.payment_method ?? null}
      currency={form.currency === 'USD' ? 'USD' : 'ARS'}
      usdRate={Number(form.usd_rate) > 0 ? Number(form.usd_rate) : 0}
      onPreferredMethodChange={(method: PaymentMethod | null) =>
        update('payment_method', backendMethodFor(method))
      }
      onPaidChange={onPaidChange}
      isAdmin={isAdmin}
    />
  );
}
