export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta'
  | 'payway_link'
  /** "Dólar billete" — se registra en USD nativos, convertidos a ARS con la
   *  cotización Dólar Blue Intermedio para impactar en el saldo/PDF. */
  | 'efectivo_usd';

export type PaymentStatus = 'Pendiente' | 'Señado Parcial' | 'Pagado';

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

export interface PaymentBreakdown {
  monto_total: number;
  monto_senia_requerida: number;
  monto_pagado_acumulado: number;
  saldo_pendiente: number;
  status: PaymentStatus;
  preferred_method: PaymentMethod | null;
  preferred_method_backend: string | null;
}
