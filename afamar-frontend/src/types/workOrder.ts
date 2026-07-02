// Work order payload — see note in budget.ts. Field names kept in
// Spanish to match the form layer (useEntityForm.ts).

import type { FabricationDetail, MaterialInForm, PoolInForm } from './budget';

export interface ConvertOptionResponse {
  message: string;
  orden_id: number;
  numero: string;
}

export interface WorkOrderPayload {
  cliente_nombre: string;
  cliente_telefono_orden: string;
  domicilio: string;
  email: string;
  fecha: string | null;
  estado: string;
  material: string;
  material_precio_m2: number;
  tipo_cambio: number;
  color_tipo: string;
  espesor: string;
  acabado: string;
  bacha: string;
  anafe: string;
  croquis: unknown;
  observaciones_diseno: string;
  detalles_fabricacion: FabricationDetail[];
  detalles_presupuestados: FabricationDetail[];
  materiales: MaterialInForm[];
  pileta_id: number | undefined;
  pileta_precio: number;
  pileta_moneda: string;
  pileta_imagen: string;
  piletas: PoolInForm[];
  subtotal: number;
  traslado: number;
  total: number;
  sena_recibida: number;
  sena_moneda: string;
  saldo_pendiente: number;
  dolar_dia: number;
  subtotal_usd: number;
  traslado_usd: number;
  total_usd: number;
  sena_usd: number;
  saldo_pendiente_usd: number;
  forma_pago: string;
  cuotas: number;
  saldo_pagado: boolean;
  fecha_pago_saldo: string | null;
  fecha_entrega: string | null;
  firma_cliente: string | null;
  fecha_aprobacion: string | null;
  observaciones: string;
  observaciones_importantes: string;
  descuento: number;
  descuento_porcentaje: number;
  descuento_monto_fijo: number;
}
