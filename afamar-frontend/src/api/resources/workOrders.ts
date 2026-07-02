import http from '../http';

export const getWorkOrders = (params?: Record<string, unknown>) => http.get('/work-orders', { params });
export const getWorkOrder = (id: number | string) => http.get(`/work-orders/${id}`);
export const createWorkOrder = (data: Record<string, unknown>) => http.post('/work-orders', mapWorkOrderToApi(data));
export const updateWorkOrder = (id: number | string, data: Record<string, unknown>) => http.put(`/work-orders/${id}`, mapWorkOrderToApi(data));
export const deleteWorkOrder = (id: number | string) => http.delete(`/work-orders/${id}`);
export const getNextWorkOrderNumber = () => http.get('/work-orders/next-number');
export const getWorkOrderPdf = (id: number | string) => `${http.defaults.baseURL}/work-orders/${id}/pdf`;
export const previewWorkOrderPdf = (data: Record<string, unknown>) =>
  http.post('/work-orders/preview-pdf', mapWorkOrderToApi(data), { responseType: 'blob' });

const WO_FIELD_MAP: Record<string, string> = {
  cliente_nombre: 'client_name',
  cliente_telefono_orden: 'client_phone',
  domicilio: 'client_address',
  email: 'client_email',
  material_precio_m2: 'material_price_m2',
  color_tipo: 'color',
  espesor: 'thickness',
  acabado: 'finish',
  tipo_cambio: 'usd_rate',
  traslado: 'transport',
  traslado_usd: 'transport_usd',
  sena_recibida: 'deposit_received',
  sena_moneda: 'deposit_currency',
  sena_usd: 'deposit_usd',
  saldo_pendiente: 'balance_due',
  saldo_pendiente_usd: 'balance_due_usd',
  saldo_pagado: 'balance_paid',
  fecha_pago_saldo: 'balance_paid_at',
  forma_pago: 'payment_method',
  fecha_entrega: 'delivery_date',
  firma_cliente: 'digital_signature',
  fecha_aprobacion: 'signed_at',
  observaciones_diseno: 'design_observations',
  observaciones: 'notes',
  observaciones_importantes: 'important_observations',
  detalles_fabricacion: 'fabrication_details',
  pileta_id: 'pool_id',
  pileta_precio: 'pool_price',
  pileta_moneda: 'pool_currency',
  pileta_imagen: 'pool_image',
  piletas: 'pools_data',
  materiales: 'materials_data',
  descuento_porcentaje: 'discount_percentage',
  descuento_monto_fijo: 'discount_fixed_amount',
  estado: 'status',
};

const WO_NESTED_MAPS: Record<string, Record<string, string>> = {
  materiales: {
    precio_m2: 'price_m2',
    precio_m2_usd: 'price_m2_usd',
    moneda: 'currency',
    largo: 'length',
    ancho: 'width',
    cantidad: 'quantity',
    es_alternativa: 'is_alternative',
  },
  piletas: {
    pileta_id: 'pool_id',
    marca: 'brand',
    modelo: 'model',
    precio: 'price',
    moneda: 'currency',
    cantidad: 'quantity',
  },
  items: {
    sector: 'sector',
    detalle: 'description',
    largo: 'length',
    ancho: 'width',
    m2: 'm2',
    cantidad: 'quantity',
    precio_m2: 'price_m2',
    precio_unitario: 'unit_price',
    total: 'total',
  },
};

function mapWorkOrderToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const targetKey = WO_FIELD_MAP[k] || k;
    if (WO_NESTED_MAPS[k] && Array.isArray(v)) {
      const innerMap = WO_NESTED_MAPS[k];
      out[targetKey] = (v as Record<string, unknown>[]).map((item) => {
        const outItem: Record<string, unknown> = {};
        for (const [ik, iv] of Object.entries(item)) {
          outItem[innerMap[ik] || ik] = iv;
        }
        return outItem;
      });
    } else if (k === 'estado') {
      out[targetKey] = mapWorkOrderStatusValue(v as string);
    } else {
      out[targetKey] = v;
    }
  }
  return out;
}

function mapWorkOrderStatusValue(status: string): string {
  const statusMap: Record<string, string> = {
    'MEDICION': 'MEASUREMENT',
    'TALLER': 'WORKSHOP',
    'TERMINADA': 'FINISHED',
    'ENTREGADA': 'DELIVERED',
    'CANCELADA': 'CANCELLED',
  };
  return statusMap[status] || status;
}

export function mapWorkOrderStatusToApi(status: string): Record<string, unknown> {
  return { status: mapWorkOrderStatusValue(status) };
}