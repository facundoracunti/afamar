import http from '../http';

export const getMaterials = (params?: Record<string, unknown>) => http.get('/materials', { params });
export const getMaterial = (id: number | string) => http.get(`/materials/${id}`);
export const getMaterialCategories = () => http.get('/materials/categories');
export const createMaterial = (data: Record<string, unknown>) => http.post('/materials', mapMaterialToApi(data));
export const updateMaterial = (id: number | string, data: Record<string, unknown>) => http.put(`/materials/${id}`, mapMaterialToApi(data));
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

// Cache for category name → id (used by mapMaterialToApi when the form sends a name).
// We keep both directions so callers can look up by name OR by id.
let _categoriaNameToId: Record<string, number> = {};
let _categoriaIdSet: Set<number> = new Set();

export async function primeMaterialCategoryMap(): Promise<void> {
  try {
    const res = await getMaterialCategories();
    // Interceptor unwraps the {success,data} envelope, so res.data IS the array.
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
  // Already an id?
  if (typeof input === 'number' && !Number.isNaN(input) && _categoriaIdSet.has(input)) return input;
  const asNumber = Number(input);
  if (!Number.isNaN(asNumber) && _categoriaIdSet.has(asNumber)) return asNumber;
  // Treat as name
  const id = _categoriaNameToId[String(input).toLowerCase()];
  return id ?? null;
}

function mapMaterialToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.name !== undefined) out.name = data.name;

  // category_id is required by the backend (Pydantic). The form sends the
  // category as either a numeric id (when the user picked from the dropdown
  // loaded via getMaterialCategories) or a free-text name (legacy/newly
  // created). We resolve in this priority order:
  //   1. If the value matches an id we already primed → use it as-is.
  //   2. If it matches a name in the cache → use its id.
  //   3. If it's a number-looking string → coerce to int.
  //   4. Otherwise → null so the backend can reject with a clear error.
  if (data.categoryId !== undefined && data.categoryId !== '' && data.categoryId !== null) {
    const raw = data.categoryId;
    let resolved: number | null = null;
    if (typeof raw === 'number' && !Number.isNaN(raw) && _categoriaIdSet.has(raw)) {
      resolved = raw;
    } else {
      const asNumber = Number(raw);
      if (!Number.isNaN(asNumber) && _categoriaIdSet.has(asNumber)) {
        resolved = asNumber;
      } else {
        const lower = String(raw).toLowerCase();
        resolved = _categoriaNameToId[lower] ?? null;
      }
    }
    if (resolved !== null) {
      out.category_id = resolved;
    } else {
      // Last-resort: try to coerce to int (the dropdown *does* send the id as a
      // string). If even that fails the backend will surface a clean 422.
      const asInt = Number(raw);
      out.category_id = Number.isNaN(asInt) ? null : asInt;
    }
  }

  if (data.color !== undefined) out.color = data.color;
  if (data.availableThickness !== undefined) out.available_thickness = data.availableThickness;
  if (data.basePrice !== undefined) out.base_price = data.basePrice;
  if (data.priceUsd !== undefined) out.price_usd = data.priceUsd;
  if (data.currency !== undefined) out.currency = data.currency;
  if (data.supplier !== undefined) out.supplier = data.supplier;
  if (data.stockAvailable !== undefined) out.stock_available = data.stockAvailable;
  if (data.notes !== undefined) out.notes = data.notes;
  Object.keys(data).forEach((k) => {
    if (!(k in out) && !['name','categoryId','availableThickness','basePrice','priceUsd','currency','supplier','stockAvailable','notes'].includes(k)) {
      out[k] = data[k];
    }
  });
  return out;
}
