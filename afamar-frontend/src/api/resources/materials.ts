import http from '../http';

export const getMaterials = (params?: Record<string, unknown>) => http.get('/materials', { params });
export const getMaterial = (id: number | string) => http.get(`/materials/${id}`);
export const getMaterialCategories = () => http.get('/materials/categories');
export const createMaterial = (data: Record<string, unknown>) => http.post('/materials', mapMaterialToApi(data));
export const updateMaterial = (id: number | string, data: Record<string, unknown>) => http.put(`/materials/${id}`, mapMaterialToApi(data));
export const deleteMaterial = (id: number | string) => http.delete(`/materials/${id}`);
export const getPriceHistory = (id: number | string) => http.get(`/materials/${id}/price-history`);

export const uploadMaterialPhoto = (id: number | string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return http.post(`/materials/${id}/upload-foto`, formData, {
    headers: { 'Content-Type': undefined },
  });
};

const _categoriaToId: Record<string, number> = {};

export async function primeMaterialCategoryMap(): Promise<void> {
  try {
    const res = await getMaterialCategories();
    const list = (res as unknown as Array<{ id: number; name: string }>) || [];
    list.forEach((c) => { _categoriaToId[c.name.toLowerCase()] = c.id; });
  } catch { /* ignore */ }
}

export function resolveCategoryId(name: string): number | null {
  if (!name) return null;
  const id = _categoriaToId[name.toLowerCase()];
  return id ?? null;
}

function mapMaterialToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.nombre !== undefined) out.name = data.nombre;
  if (data.categoria !== undefined) {
    const id = resolveCategoryId(String(data.categoria));
    if (id !== null) out.category_id = id;
  } else if (data.category_id !== undefined) {
    out.category_id = data.category_id;
  }
  if (data.color !== undefined) out.color = data.color;
  if (data.espesor_disponible !== undefined) out.available_thickness = data.espesor_disponible;
  if (data.precio_m2 !== undefined) out.base_price = data.precio_m2;
  if (data.precio_m2_usd !== undefined) out.price_usd = data.precio_m2_usd;
  if (data.moneda !== undefined) out.currency = data.moneda;
  if (data.proveedor !== undefined) out.supplier = data.proveedor;
  if (data.stock_disponible !== undefined) out.stock_available = data.stock_disponible;
  if (data.observaciones !== undefined) out.notes = data.observaciones;
  Object.keys(data).forEach((k) => {
    if (!(k in out) && !['nombre','categoria','espesor_disponible','precio_m2','precio_m2_usd','moneda','proveedor','stock_disponible','observaciones'].includes(k)) {
      out[k] = data[k];
    }
  });
  return out;
}