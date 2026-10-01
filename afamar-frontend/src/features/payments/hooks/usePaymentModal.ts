/**
 * Toda la lógica de estado + derivación + handlers de `PaymentModal` en un
 * hook puro (sin JSX). El modal queda como orchestrator fino que reparte el
 * render entre subcomponentes; este hook concentra la regla de cálculo del
 * monto (preset → monto base), el recargo de tarjeta, la conversión USD del
 * "Dólar billete" y la generación del link de Payway.
 */
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { createPaywayCheckout } from '@/api/resources/payway';
import { useNotify } from '../../../context/NotificationContext';
import { round2, usdFromArs } from '../utils/paymentFormat';
import { CONCEPT_BY_PRESET } from '../types/payment.types';
import type {
  AmountPreset,
  PaymentConcept,
  PaymentMethod,
  PaymentModalProps,
} from '../types/payment.types';

/** Value setter — los subcomponentes solo necesitan asignar el valor, no la
 *  variante función-actualizadora de `useState`. */
export type PaymentValueSetter<T> = (value: T) => void;

export interface UsePaymentModalReturn {
  preset: AmountPreset;
  setPreset: PaymentValueSetter<AmountPreset>;
  customAmount: string;
  setCustomAmount: PaymentValueSetter<string>;
  loteCupon: string;
  setLoteCupon: PaymentValueSetter<string>;
  paywayLinkUrl: string | null;
  setPaywayLinkUrl: PaymentValueSetter<string | null>;
  paywayGenerating: boolean;
  setPaywayGenerating: PaymentValueSetter<boolean>;
  tarjetaSurchargePercent: string;
  setTarjetaSurchargePercent: PaymentValueSetter<string>;
  confirming: boolean;
  setConfirming: PaymentValueSetter<boolean>;
  method: PaymentMethod | null;
  isUsdMethod: boolean;
  displayCurrency: 'ARS' | 'USD';
  saldoPendiente: number;
  remainingSeniaArs: number;
  seniaCumplida: boolean;
  concept: PaymentConcept;
  amount: number;
  amountArs: number;
  canSubmit: boolean;
  surchargePercent: number;
  surchargeMultiplier: number;
  amountFinal: number;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  handleConfirmSubmit: () => Promise<void>;
  handleGeneratePaywayLink: () => Promise<void>;
}

export function usePaymentModal(props: PaymentModalProps): UsePaymentModalReturn {
  const notify = useNotify();
  const {
    isOpen,
    onSubmit,
    montoSeniaRequerida,
    montoPagadoAcumulado,
    saldoPendiente,
    currency = 'ARS',
    usdRate = 0,
    defaultMethod = null,
    loading = false,
    hasPaymentsInSession = false,
    orderId,
    orderNumber,
    clientName,
  } = props;

  const [preset, setPresetState] = useState<AmountPreset>('suggested_seña');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loteCupon, setLoteCupon] = useState<string>('');
  const [paywayLinkUrl, setPaywayLinkUrl] = useState<string | null>(null);
  const [paywayGenerating, setPaywayGenerating] = useState<boolean>(false);
  const [tarjetaSurchargePercent, setTarjetaSurchargePercent] = useState<string>('');
  const [confirming, setConfirming] = useState<boolean>(false);

  // Los setters expuestos solo aceptan el valor directo (el subcomponente
  // los invoca con un literal). `useState` los despacha por igual.
  const setPreset: PaymentValueSetter<AmountPreset> =
    setPresetState as Dispatch<SetStateAction<AmountPreset>>;

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
      setPresetState(hayCobrosPrevios ? 'remaining_balance' : 'suggested_seña');
      setCustomAmount('');
      setLoteCupon('');
      setPaywayLinkUrl(null);
      setTarjetaSurchargePercent('');
      setConfirming(false);
    }
    // Solo queremos resetear al abrir/cerrar — el resto de los cambios
    // los manejan los handlers de cada input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // El método se deriva del `defaultMethod`: la modal ya no expone su
  // propio selector — el operador lo define en la tarjeta de resumen.
  const method: PaymentMethod | null = defaultMethod;

  // "Dólar billete": el pago se registra en USD nativos y se convierte a
  // ARS con la cotización Dólar Blue Intermedio para impacto en el saldo.
  const isUsdMethod = method === 'efectivo_usd';
  const displayCurrency: 'ARS' | 'USD' = isUsdMethod ? 'USD' : currency;

  const remainingSeniaArs = Math.max(montoSeniaRequerida - montoPagadoAcumulado, 0);
  // Solo consideramos la seña "cumplida" cuando hay un importe sugerido
  // (>0) Y ya se pagó al menos eso (el comparativo se hace en ARS, la
  // moneda del módulo). Si el operador aún no cargó una seña contractual,
  // dejamos la opción habilitada para que pueda cobrar un pago parcial o
  // personalizado.
  const seniaCumplida =
    montoSeniaRequerida > 0 && montoPagadoAcumulado >= montoSeniaRequerida;

  // Concepto derivado del preset — se confirma en el paso 2 y se persiste
  // en la descripción del movimiento de caja.
  const concept: PaymentConcept = CONCEPT_BY_PRESET[preset];

  const amount = useMemo<number>(() => {
    if (preset === 'suggested_seña') {
      return isUsdMethod ? usdFromArs(remainingSeniaArs, usdRate) : remainingSeniaArs;
    }
    if (preset === 'remaining_balance') {
      return isUsdMethod ? usdFromArs(saldoPendiente, usdRate) : saldoPendiente;
    }
    const parsed = Number(customAmount);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [preset, remainingSeniaArs, saldoPendiente, customAmount, isUsdMethod, usdRate]);

  const amountArs = isUsdMethod && usdRate > 0 ? round2(amount * usdRate) : amount;

  // En "Dólar billete" se necesita una cotización válida para traducir el
  // pago a ARS (sin eso el saldo pendiente / PDF no pueden sumarlo).
  // Además, el registro queda bloqueado cuando no hay saldo pendiente
  // (cobro completo) en cualquiera de los montos.
  const canSubmit =
    method !== null &&
    amount > 0 &&
    !loading &&
    (!isUsdMethod || usdRate > 0) &&
    saldoPendiente > 0;

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
    // Paso 1 del registro: el operador confirma el monto y el concepto
    // antes de que la modal dispare el POST.
    setConfirming(true);
  };

  const handleConfirmSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    try {
      await onSubmit({
        method,
        amount: amountFinal,
        baseAmount: amount,
        currency: isUsdMethod ? 'USD' : currency,
        amount_ars: isUsdMethod ? amountArs : undefined,
        usd_rate: isUsdMethod ? (usdRate > 0 ? usdRate : undefined) : undefined,
        lote_cupon: method === 'tarjeta' && loteCupon.trim() !== '' ? loteCupon.trim() : null,
        payway_link_url: method === 'payway_link' ? paywayLinkUrl : null,
        tarjeta_surcharge_percent: surchargePercent,
        concept,
      });
    } catch {
      // El padre notifica el error (notify). Volvemos a la modal de
      // edición para que el operador pueda corregir y reintentar.
      setConfirming(false);
    }
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

  return {
    preset,
    setPreset,
    customAmount,
    setCustomAmount,
    loteCupon,
    setLoteCupon,
    paywayLinkUrl,
    setPaywayLinkUrl,
    paywayGenerating,
    setPaywayGenerating,
    tarjetaSurchargePercent,
    setTarjetaSurchargePercent,
    confirming,
    setConfirming,
    method,
    isUsdMethod,
    displayCurrency,
    saldoPendiente,
    remainingSeniaArs,
    seniaCumplida,
    concept,
    amount,
    amountArs,
    canSubmit,
    surchargePercent,
    surchargeMultiplier,
    amountFinal,
    handleSubmit,
    handleConfirmSubmit,
    handleGeneratePaywayLink,
  };
}