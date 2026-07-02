import type { EntityFormState } from '../types';
import type { Material } from '../types/material';
import type { MaterialEnForm, PiletaEnForm } from '../types';

export const CONCEPTOS_M2 = ['ZÓCALO', 'FRENTE'];

export const TRAFORO_DETALLES: Record<string, string> = {
  'TRAFORO DE PILETA': 'APERTURA Y PEGADO DE PILETA',
  'TRAFORO DE ANAFE': 'APERTURA DE ANAFE',
  'TRAFORO DE PILETA DE APOYO': 'APERTURA PILETA DE APOYO',
};

export const CONCEPTO_NORMALIZE: Record<string, string> = {
  'APERTURA + PEGADO PILETA': 'TRAFORO DE PILETA',
  'APERTURA Y PEGADO DE PILETA': 'TRAFORO DE PILETA',
  'APERTURA ANAFE': 'TRAFORO DE ANAFE',
  'APERTURA DE ANAFE': 'TRAFORO DE ANAFE',
  'APERTURA PILETA APOYO': 'TRAFORO DE PILETA DE APOYO',
  'APERTURA PILETA DE APOYO': 'TRAFORO DE PILETA DE APOYO',
};

export const INITIAL_FORM: EntityFormState = {
  numero: '',
  cliente_nombre: '', cliente_telefono_orden: '', domicilio: '', email: '',
  fecha: new Date().toISOString().slice(0, 10),
  estado: '',
  material: '', material_precio_m2: 0, color_tipo: '', espesor: '', acabado: '', tipo_cambio: 1,
  bacha: '', anafe: '',
  croquis: [],
  observaciones_diseno: '',
  detalles_fabricacion: [],
  pileta_id: '', pileta_imagen: '', pileta_precio: 0, pileta_moneda: 'ARS',
  subtotal: 0, traslado: 0, total: 0,
  sena_recibida: 0, sena_moneda: 'ARS', saldo_pendiente: 0, forma_pago: '', saldo_pagado: false, fecha_pago_saldo: '',
  dolar_dia: 1000,
  cuotas: 1,
  subtotal_usd: 0, traslado_usd: 0, total_usd: 0, sena_usd: 0, saldo_pendiente_usd: 0,
  fecha_entrega: '',
  firma_cliente: null, fecha_aprobacion: '',
  observaciones: '', observaciones_importantes: '',
  detalles_presupuestados: [],
  materiales: [],
  piletas: [],
  orden_trabajo_numero: null,
  descuento_porcentaje: 0,
  descuento_monto_fijo: 0,
  recargo_ars: 0,
  recargo_usd: 0,
  recargo_pct: 0,
};

const MATERIAL_FIELD_MAP: Record<string, string> = {
  precio_m2: 'price_m2',
  precio_m2_usd: 'price_m2_usd',
  moneda: 'currency',
  largo: 'length',
  ancho: 'width',
  cantidad: 'quantity',
  es_alternativa: 'is_alternative',
};

const PILETA_FIELD_MAP: Record<string, string> = {
  pileta_id: 'pool_id',
  marca: 'brand',
  modelo: 'model',
  precio: 'price',
  moneda: 'currency',
  cantidad: 'quantity',
};

function mapNestedArray(arr: unknown, fieldMap: Record<string, string>): unknown {
  if (!Array.isArray(arr)) return arr;
  return arr.map((item) => {
    if (typeof item !== 'object' || item === null) return item;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      out[fieldMap[k] || k] = v;
    }
    return out;
  });
}

export function buildPayload(form: EntityFormState): Record<string, unknown> {
  return {
    client_name: form.cliente_nombre,
    client_phone: form.cliente_telefono_orden,
    client_address: form.domicilio,
    client_email: form.email,
    date: form.fecha ? new Date(form.fecha).toISOString() : null,
    status: form.estado,
    material: form.material,
    material_price_m2: Number(form.material_precio_m2) || 0,
    usd_rate: Number(form.dolar_dia) || Number(form.tipo_cambio) || 1000,
    color: form.color_tipo,
    thickness: form.espesor,
    finish: form.acabado,
    bacha: form.bacha,
    anafe: form.anafe,
    sketch_elements: Array.isArray(form.croquis)
      ? form.croquis.map((pag: unknown) => {
          const p = pag as Record<string, unknown>;
          return {
            ...p,
            data: ((p.dibujo || p.elementos) as Array<Record<string, unknown>> || []).map((el: Record<string, unknown>) => {
              const { seleccionado, ...rest } = el;
              return rest;
            }),
          };
        })
      : form.croquis,
    design_observations: form.observaciones_diseno,
    fabrication_details: form.detalles_fabricacion,
    materials_data: mapNestedArray(form.materiales, MATERIAL_FIELD_MAP),
    pool_id: form.pileta_id ? Number(form.pileta_id) : undefined,
    pool_price: Number(form.pileta_precio) || 0,
    pool_currency: form.pileta_moneda || 'ARS',
    pool_image: form.pileta_imagen,
    pools_data: mapNestedArray(form.piletas, PILETA_FIELD_MAP),
    subtotal: Number(form.subtotal),
    transport: Number(form.traslado),
    total: Number(form.total),
    deposit_received: Number(form.sena_recibida),
    deposit_currency: form.sena_moneda || 'ARS',
    deposit_usd: Number(form.sena_usd),
    balance_due: Number(form.saldo_pendiente),
    balance_due_usd: Number(form.saldo_pendiente_usd),
    subtotal_usd: Number(form.subtotal_usd),
    transport_usd: Number(form.traslado_usd),
    total_usd: Number(form.total_usd),
    payment_method: form.forma_pago,
    installments: form.cuotas || 1,
    balance_paid: form.saldo_pagado || false,
    balance_paid_at: form.fecha_pago_saldo || null,
    delivery_date: form.fecha_entrega ? new Date(form.fecha_entrega).toISOString() : null,
    digital_signature: form.firma_cliente,
    signed_at: form.fecha_aprobacion ? new Date(form.fecha_aprobacion).toISOString() : null,
    notes: form.observaciones,
    important_observations: form.observaciones_importantes,
    discount:
      Number(form.descuento_monto_fijo) > 0
        ? Number(form.descuento_monto_fijo)
        : Number(form.descuento_porcentaje) > 0
          ? Number(form.descuento_porcentaje)
          : 0,
    discount_percentage: Number(form.descuento_porcentaje) || 0,
    discount_fixed_amount: Number(form.descuento_monto_fijo) || 0,
  };
}

export function mapApiToForm(d: Record<string, unknown>, defaultEstado: string): EntityFormState {
  return {
    ...INITIAL_FORM,
    numero: (d.numero as string) || '',
    cliente_nombre: (d.cliente_nombre as string) || '',
    cliente_telefono_orden: (d.cliente_telefono_orden as string) || '',
    domicilio: (d.domicilio as string) || '',
    email: (d.email as string) || '',
    fecha: d.fecha ? (d.fecha as string).slice(0, 10) : new Date().toISOString().slice(0, 10),
    estado: (d.estado as string) || defaultEstado,
    material: (d.material as string) || '',
    material_precio_m2: (d.material_precio_m2 as number) || 0,
    tipo_cambio: (d.tipo_cambio as number) || 1,
    color_tipo: (d.color_tipo as string) || '',
    espesor: (d.espesor as string) || '',
    acabado: (d.acabado as string) || '',
    bacha: (d.bacha as string) || '',
    anafe: (d.anafe as string) || '',
    croquis: (d.croquis as unknown[]) || [],
    observaciones_diseno: (d.observaciones_diseno as string) || '',
    detalles_fabricacion: (d.detalles_fabricacion as Array<Record<string, unknown>>)?.length
      ? (d.detalles_fabricacion as Array<Record<string, unknown>>).map((df: Record<string, unknown>) => {
          const det = ((df.detalle as string) || '').toUpperCase();
          const conTexto = ((df.concepto as string) || '').toUpperCase();
          let concepto = (df.concepto as string) || '';
          let detalle = (df.detalle as string) || '';
          if (CONCEPTO_NORMALIZE[det] || CONCEPTO_NORMALIZE[conTexto]) {
            const norm = CONCEPTO_NORMALIZE[det] || CONCEPTO_NORMALIZE[conTexto];
            concepto = norm;
            detalle = TRAFORO_DETALLES[norm] || det;
          }
          return {
            ...df, concepto, detalle,
            largo: (df.largo as number) ?? null,
            ancho: (df.ancho as number) ?? null,
            m2: (df.m2 as number) || 0,
            mano_de_obra: (df.mano_de_obra as number) ?? null,
            precio: (df.precio as number) || 0,
          };
        })
      : [],
    detalles_presupuestados: (d.detalles_presupuestados as Array<Record<string, unknown>>) || [],
    materiales: ((d.materiales as Array<Record<string, unknown>>) || []).map((m: Record<string, unknown>) => ({
      ...m,
      m2_presupuestado: (m.m2_presupuestado as number) || (Number(m.largo || 0) * Number(m.ancho || 0) * ((m.cantidad as number) || 1)),
    })),
    piletas: (d.piletas as Array<Record<string, unknown>>) || [],
    pileta_id: (d.pileta_id as string) || '',
    pileta_precio: (d.pileta_precio as number) || 0,
    pileta_moneda: (d.pileta_moneda as string) || 'ARS',
    pileta_imagen: (d.pileta_imagen as string) || '',
    subtotal: (d.subtotal as number) || 0,
    traslado: (d.traslado as number) || 0,
    total: (d.total as number) || 0,
    sena_recibida: (d.sena_recibida as number) || 0,
    sena_moneda: (d.sena_moneda as string) || 'ARS',
    saldo_pendiente: (d.saldo_pendiente as number) || 0,
    forma_pago: (d.forma_pago as string) || '',
    cuotas: (d.cuotas as number) || 1,
    saldo_pagado: (d.saldo_pagado as boolean) || false,
    fecha_pago_saldo: d.fecha_pago_saldo ? (d.fecha_pago_saldo as string).slice(0, 10) : '',
    dolar_dia: (d.dolar_dia as number) ?? 1000,
    subtotal_usd: (d.subtotal_usd as number) || 0,
    traslado_usd: (d.traslado_usd as number) || 0,
    total_usd: (d.total_usd as number) || 0,
    sena_usd: (d.sena_usd as number) || 0,
    saldo_pendiente_usd: (d.saldo_pendiente_usd as number) || 0,
    fecha_entrega: d.fecha_entrega ? (d.fecha_entrega as string).slice(0, 10) : '',
    firma_cliente: (d.firma_cliente as string) || null,
    fecha_aprobacion: d.fecha_aprobacion ? (d.fecha_aprobacion as string).slice(0, 10) : '',
    observaciones: (d.observaciones as string) || '',
    observaciones_importantes: (d.observaciones_importantes as string) || '',
    descuento_porcentaje: (d.descuento_porcentaje as number) ?? 0,
    descuento_monto_fijo: (d.descuento_monto_fijo as number) ?? 0,
  } as unknown as EntityFormState;
}

export function addMaterialToList(
  form: EntityFormState,
  materiales: Material[],
  nombre: string
): MaterialEnForm[] | null {
  if (!nombre) return null;
  const mat = materiales.find((m) => m.nombre === nombre);
  if (!mat) return null;
  return [
    ...(form.materiales || []),
    {
      nombre: mat.nombre, categoria: mat.categoria || '', color: mat.color || '',
      precio_m2: mat.precio_m2 || 0, precio_m2_usd: mat.precio_m2_usd || 0,
      moneda: mat.moneda || 'ARS', cantidad: 1, m2_utilizados: 0, m2_presupuestado: 0,
      largo: 0, ancho: 0, es_alternativa: false,
    } as MaterialEnForm,
  ];
}

export function addPiletaToList(
  form: EntityFormState,
  piletas: import('../types/stockPileta').StockPileta[],
  pid: string
): PiletaEnForm[] | null {
  if (!pid) return null;
  const pt = piletas.find((p) => p.id === Number(pid));
  if (!pt) return null;
  return [
    ...(form.piletas || []),
    {
      pileta_id: pt.id, marca: pt.marca, modelo: pt.modelo,
      precio: pt.precio || 0, moneda: 'ARS' as const, imagen: '', cantidad: 1,
    } as PiletaEnForm,
  ];
}
