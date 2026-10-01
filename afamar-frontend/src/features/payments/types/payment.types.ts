export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta'
  | 'payway_link'
  /** "Dólar billete" — se registra en USD nativos, convertidos a ARS con la
   *  cotización Dólar Blue Intermedio para impactar en el saldo/PDF. */
  | 'efectivo_usd';

export type PaymentStatus = 'Pendiente' | 'Señado Parcial' | 'Pagado';

/** Concepto de cobro — el label se persiste en la descripción del movimiento
 *  de caja como `Concepto: <label>` (criterio de identificación del módulo
 *  y columna del historial de pagos). */
export type PaymentConcept = 'Seña' | 'Saldo Restante' | 'Monto Personalizado';

export interface PaymentTransaction {
  id: string;
  order_id: number;
  budget_id: number | null;
  method: PaymentMethod;
  amount: number;
  currency: 'ARS' | 'USD';
  status: PaymentStatus;
  lote_cupon: string | null;
  payway_link_url: string | null;
  registered_at: string;
  cash_movement_id: number | null;
  /** Concepto de cobro ("Seña" / "Saldo Restante" / "Monto Personalizado").
   *  Los movimientos del módulo se persisten en la descripción de la caja
   *  como `Concepto: <label>`. Null en pagos legacy sin concepto. */
  concept?: string | null;
  /** Recargo % aplicado al cobrar con tarjeta (manual del operador). El
   *  `amount` ya lo incluye. Null si no aplica. */
  tarjeta_surcharge_percent?: number | null;
  /** Equivalente en ARS del pago (solo para `currency === 'USD'`). El
   *  saldo pendiente / acumulado del módulo siempre suma en ARS. */
  amount_ars?: number | null;
  /** Cotización USD usada para convertir `amount` → `amount_ars` (Dólar
   *  Blue Intermedio). Solo para `currency === 'USD'`. */
  usd_rate?: number | null;
}

/** Pago registrado en sesión (o recién persistido) dentro del historial del
 *  módulo. Extiende `PaymentTransaction` con el recargo % de tarjeta que se
 *  muestra como línea informativa en la gestión. */
export interface RegisteredPayment extends PaymentTransaction {
  /** Recargo % con el que se registró el pago (solo tarjeta). Frontera
   *  persistida: el payload lleva `tarjeta_surcharge_percent` y el backend lo
   *  devuelve hidratado en `amount_ars`/`description` cuando aplica. */
  tarjeta_surcharge_percent?: number | null;
}

export interface PaymentBreakdown {
  monto_total: number;
  monto_senia_requerida: number;
  monto_pagado_acumulado: number;
  saldo_pendiente: number;
  status: PaymentStatus;
  preferred_method: PaymentMethod | null;
  preferred_method_backend: string | null;
}

/** Preset del monto a cobrar dentro de la gestión de pago. `suggested_seña`
 *  arranca en la seña requerida (o el saldo restante si la seña ya fue
 *  cubierta); `remaining_balance` toma lo que falta del total; `custom`
 *  deja que el operador escriba un monto libre. */
export type AmountPreset = 'suggested_seña' | 'remaining_balance' | 'custom';

/** Payload de registro de pago — lo que el hook de acción persiste como
 *  `CashMovement` en el backend. `amount` viene en la moneda nativa del
 *  método (`currency`); para USD el hook añade `amount_ars` y `usd_rate`. */
export interface NewPaymentTransaction {
  method: PaymentMethod;
  /** Monto en la moneda nativa del método (`currency`). Incluye el recargo
   *  de tarjeta como el operador lo tipea (el `surcharge` del modal va como
   *  línea informativa, no se suma en el input). */
  amount: number;
  /** Base sobre la que se aplicó el recargo (solo tarjeta). */
  baseAmount?: number;
  currency: 'ARS' | 'USD';
  /** Equivalente en ARS (solo `currency === 'USD'`). */
  amount_ars?: number;
  /** Cotización usada para la conversión (Dólar Blue Intermedio). */
  usd_rate?: number;
  lote_cupon: string | null;
  payway_link_url: string | null;
  /** Recargo % aplicado al cobrar con tarjeta. */
  tarjeta_surcharge_percent?: number | null;
  /** Concepto de cobro — se persiste como `Concepto: <label>` en la
   *  descripción del movimiento de caja. */
  concept?: PaymentConcept;
}

/** Props de `PaymentModal` — el modal recibe los montos del resumen, la
 *  moneda activa de la seña y los callbacks de persistencia. */
export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Persiste el pago registrado (espera el `NewPaymentTransaction`). El
   *  hook espera que rechace la Promise si el POST falla. */
  onSubmit: (tx: NewPaymentTransaction) => void | Promise<unknown>;
  montoTotal: number;
  montoSeniaRequerida: number;
  montoPagadoAcumulado: number;
  saldoPendiente: number;
  currency?: 'ARS' | 'USD';
  usdRate?: number;
  defaultMethod?: PaymentMethod | null;
  loading?: boolean;
  hasPaymentsInSession?: boolean;
  orderId?: number | null;
  orderNumber?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
}

/** Mapeo preset → concepto checkbox. */
export const CONCEPT_BY_PRESET: Record<AmountPreset, PaymentConcept> = {
  suggested_seña: 'Seña',
  remaining_balance: 'Saldo Restante',
  custom: 'Monto Personalizado',
};