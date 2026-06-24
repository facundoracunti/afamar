export interface MovimientoCaja {
  id: number;
  orden_trabajo_id?: number;
  tipo: string;
  monto: number;
  forma_pago?: string;
  saldo_restante?: number;
  observaciones?: string;
  created_at?: string;
}
