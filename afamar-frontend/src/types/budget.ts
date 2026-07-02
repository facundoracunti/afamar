// Budget form schema types. Field names are kept in Spanish because
// the form layer (`useEntityForm.ts`, `useCalculosPresupuesto.ts`,
// `OnlineItemsTable.tsx`, and the form pages) reads/writes these
// fields with Spanish keys. Migrating the field names is a separate
// task (PLAN.md #9 — replace useEntityForm).

export interface FabricationDetail {
  concepto: string;
  detalle: string;
  concepto_personalizado?: string;
  material?: string;
  material_precio_m2?: number;
  largo: number | null;
  ancho: number | null;
  m2: number;
  mano_de_obra: number | null;
  moneda: 'ARS' | 'USD';
  cantidad: number;
  precio: number;
}

export interface BudgetItemSchema {
  id?: number;
  sector?: string;
  unidad_largo?: string;
  unidad_ancho?: string;
  largo?: number;
  ancho?: number;
  m2?: number;
  cantidad?: number;
  precio_m2?: number;
  subtotal?: number;
}

export interface BudgetAdditionalSchema {
  id?: number;
  concepto?: string;
  detalle?: string;
  cantidad?: number;
  precio_unitario?: number;
  subtotal?: number;
}

export interface MaterialInForm {
  nombre: string;
  categoria?: string;
  color?: string;
  precio_m2: number;
  precio_m2_usd: number;
  moneda: 'ARS' | 'USD';
  cantidad: number;
  m2_utilizados: number;
  m2_presupuestado: number;
  largo: number;
  ancho: number;
  es_alternativa: boolean;
}

export interface PoolInForm {
  pileta_id: number;
  marca: string;
  modelo: string;
  precio: number;
  moneda: 'ARS' | 'USD';
  imagen?: string;
  cantidad: number;
}

export interface BudgetPayload {
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

export interface UnifiedBudget {
  tipo: string;
  id: number;
  numero: string;
  orden_trabajo_numero?: string;
  fecha: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  materiales?: Array<{ nombre: string }>;
  items?: Array<{ detalle: string; material?: string }>;
  material?: string;
  observaciones_diseno?: string;
  total: number;
  estado: string;
}
