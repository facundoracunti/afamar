import http from '../http';

export const getMaterials = (params?: Record<string, unknown>) => http.get('/materials', { params });
export const getMaterial = (id: number | string) => http.get(`/materials/${id}`);
export const getMaterialCategories = () => http.get('/materials/categories');

/**
 * Coerce the form's `category_id` (string from `<option value>`) to a
 * number so the Pydantic schema (which expects `int`) accepts it.
 * The rest of the form payload is already snake_case to match the API
 * and is passed through unchanged.
 */
function normalizeMaterialPayload(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  if (out.category_id !== undefined && out.category_id !== '' && out.category_id !== null) {
    const asNumber = Number(out.category_id);
    out.category_id = Number.isNaN(asNumber) ? null : asNumber;
  }
  return out;
}

export const createMaterial = (data: Record<string, unknown>) =>
  http.post('/materials', normalizeMaterialPayload(data));
export const updateMaterial = (id: number | string, data: Record<string, unknown>) =>
  http.put(`/materials/${id}`, normalizeMaterialPayload(data));
export const deleteMaterial = (id: number | string) => http.delete(`/materials/${id}`);
export const getPriceHistory = (id: number | string) => http.get(`/materials/${id}/price-history`);

// Material categories CRUD
export interface MaterialCategory {
  id: number;
  name: string;
}
export const createMaterialCategory = (data: { name: string }) => http.post('/materials/categories', data);
export const updateMaterialCategory = (id: number | string, data: { name: string }) => http.put(`/materials/categories/${id}`, data);
export const deleteMaterialCategory = (id: number | string) => http.delete(`/materials/categories/${id}`);

export const uploadMaterialPhoto = (id: number | string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return http.post(`/materials/${id}/upload-foto`, formData, {
    headers: { 'Content-Type': undefined },
  });
};

// Cache for category name → id (legacy: used by code paths that still
// receive category names instead of ids). Kept for backward compatibility
// with older callers.
let _categoriaNameToId: Record<string, number> = {};
let _categoriaIdSet: Set<number> = new Set();

export async function primeMaterialCategoryMap(): Promise<void> {
  try {
    const res = await getMaterialCategories();
    const list = (res.data as unknown as MaterialCategory[]) || [];
    _categoriaNameToId = {};
    _categoriaIdSet = new Set();
    list.forEach((c) => {
      _categoriaNameToId[c.name.toLowerCase()] = c.id;
      _categoriaIdSet.add(c.id);
    });
  } catch { /* ignore — keep existing map */ }
}

export function resolveCategoryId(input: string | number): number | null {
  if (input === '' || input === null || input === undefined) return null;
  if (typeof input === 'number' && !Number.isNaN(input) && _categoriaIdSet.has(input)) return input;
  const asNumber = Number(input);
  if (!Number.isNaN(asNumber) && _categoriaIdSet.has(asNumber)) return asNumber;
  const id = _categoriaNameToId[String(input).toLowerCase()];
  return id ?? null;
}
