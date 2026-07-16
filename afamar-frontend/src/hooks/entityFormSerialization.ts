/**
 * Entity form ↔ API serialization helpers.
 */

import type { EntityFormState } from '../types';
import { todayLocalISO } from '../utils/formatters';
import { INITIAL_FORM } from './entityFormConstants';
import { buildFinancialPayload, mapFinancialToForm } from './entityFormFinancial';

export { todayLocalISO };

function jsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function flattenSketchElements(raw: unknown): { type: string; data: string | null; order: number }[] {
  if (!raw) return [];
  const out: { type: string; data: string | null; order: number }[] = [];
  const tryPush = (e: Record<string, unknown>, fallbackOrder: number) => {
    if (typeof e.type !== 'string') return;
    const { type: _t, order: _o, ...rest } = e;
    void _t;
    void _o;
    let dataStr: string | null = null;
    try {
      dataStr = JSON.stringify(rest);
    } catch {
      dataStr = null;
    }
    out.push({
      type: e.type,
      data: dataStr,
      order: typeof e.order === 'number' ? e.order : fallbackOrder,
    });
  };

  if (Array.isArray(raw)) {
    const looksLikePagesArray = raw.length === 0 || raw.every((p) => p && typeof p === 'object' && ('dibujo' in p || 'pagina_id' in p || 'elements' in p));
    if (looksLikePagesArray) {
      let order = 0;
      raw.forEach((page: unknown) => {
        const obj = page as Record<string, unknown> | null;
        if (!obj) return;
        const dibujo = obj.dibujo;
        if (Array.isArray(dibujo)) {
          dibujo.forEach((e) => tryPush(e as Record<string, unknown>, order++));
        } else if (Array.isArray(obj.elements)) {
          obj.elements.forEach((e) => tryPush(e as Record<string, unknown>, order++));
        }
      });
      return out;
    }
    raw.forEach((e, idx) => tryPush(e as Record<string, unknown>, idx));
    return out;
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.pages)) {
      let order = 0;
      obj.pages.forEach((page: unknown) => {
        const elements = (page as Record<string, unknown> | null)?.elements;
        if (Array.isArray(elements)) {
          elements.forEach((e) => tryPush(e as Record<string, unknown>, order++));
        }
      });
    } else if (Array.isArray(obj.elements)) {
      let order = 0;
      obj.elements.forEach((e) => tryPush(e as Record<string, unknown>, order++));
    }
  }
  return out;
}

function unflattenSketchElements(raw: unknown): { pagina_id: number; name: string; dibujo: unknown[] }[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      // Treat as empty
    }
  }
  if (arr.length === 0) return [];
  return [{
    pagina_id: 1,
    name: 'Página 1',
    dibujo: arr.map((e) => {
      if (!e || typeof e !== 'object') return e;
      const obj = e as Record<string, unknown>;
      const { type, data, order: _o, ...rest } = obj;
      void _o;
      let parsed: Record<string, unknown> = {};
      if (typeof data === 'string' && data.length > 0) {
        try { parsed = JSON.parse(data) as Record<string, unknown>; } catch { parsed = {}; }
      } else if (data && typeof data === 'object') {
        parsed = data as Record<string, unknown>;
      }
      return { ...parsed, type };
    }),
  }];
}

function jsonParseList(raw: unknown): unknown[] {
  if (raw === null || raw === undefined || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw
        .split(/[;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function toIsoFromDate(dateStr: string): string | null {
  if (!dateStr) return null;
  return dateStr;
}

function sliceDateToInput(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function buildPayload(form: EntityFormState): Record<string, unknown> {
  return {
    client_name: form.client_name,
    client_phone: form.client_phone,
    client_address: form.client_address,
    client_email: form.client_email,
    delivery_address_id: form.delivery_address_id ? Number(form.delivery_address_id) : null,
    date: form.date ? toIsoFromDate(form.date) : null,
    status: form.status,
    material: form.material,
    material_price_m2: Number(form.material_price_m2) || 0,
    color: form.color,
    thickness: form.thickness,
    finish: form.finish,
    bacha: form.bacha,
    anafe: form.anafe,
    pool_id: form.pool_id ? Number(form.pool_id) : undefined,
    pool_price: Number(form.pool_price) || 0,
    pool_currency: form.pool_currency || 'ARS',
    pool_image: form.pool_image,
    ...buildFinancialPayload(form),
    balance_paid: form.balance_paid || false,
    balance_paid_at: form.balance_paid_at || null,
    delivery_date: form.delivery_date ? toIsoFromDate(form.delivery_date) : null,
    digital_signature: form.digital_signature,
    signed_at: form.signed_at ? toIsoFromDate(form.signed_at) : null,
    notes: form.notes,
    design_observations: form.design_observations,
    important_observations: form.important_observations,
    fabrication_details: jsonStringify(form.fabrication_details),
    materials_data: jsonStringify(form.materials_data),
    pools_data: jsonStringify(form.pools_data),
    sketch_elements: jsonStringify(flattenSketchElements(form.sketch_elements)),
    additional_works_data: form.additional_works_data || '[]',
  };
}

export function mapApiToForm(d: Record<string, unknown>, defaultStatus: string): EntityFormState {
  return {
    ...INITIAL_FORM,
    ...mapFinancialToForm(d),
    client_name: (d.client_name as string) || '',
    client_phone: (d.client_phone as string) || '',
    client_address: (d.client_address as string) || '',
    client_email: (d.client_email as string) || '',
    delivery_address_id: (d.delivery_address_id as number | null) ?? null,
    number: (d.number as string) || (d.numero as string) || '',
    date: sliceDateToInput(d.date) || todayLocalISO(),
    status: (d.status as string) || (d.estado as string) || defaultStatus,
    material: (d.material as string) || '',
    material_price_m2: (d.material_price_m2 as number) || 0,
    color: (d.color as string) || '',
    thickness: (d.thickness as string) || '',
    finish: (d.finish as string) || '',
    bacha: (d.bacha as string) || '',
    anafe: (d.anafe as string) || '',
    pool_id: (d.pool_id as number | string | null | undefined) ?? '',
    pool_price: (d.pool_price as number) || 0,
    pool_currency: (d.pool_currency as string) || 'ARS',
    pool_image: (d.pool_image as string) || '',
    balance_paid: (d.balance_paid as boolean) || false,
    balance_paid_at: sliceDateToInput(d.balance_paid_at) || '',
    delivery_date: sliceDateToInput(d.delivery_date) || '',
    digital_signature: (d.digital_signature as string) || null,
    signed_at: sliceDateToInput(d.signed_at) || '',
    notes: (d.notes as string) || '',
    design_observations: (d.design_observations as string) || '',
    important_observations: (d.important_observations as string) || '',
    fabrication_details: jsonParseList(d.fabrication_details) as EntityFormState['fabrication_details'],
    materials_data: jsonParseList(d.materials_data) as EntityFormState['materials_data'],
    pools_data: jsonParseList(d.pools_data) as EntityFormState['pools_data'],
    sketch_elements: unflattenSketchElements(d.sketch_elements) as unknown[],
    additional_works_data: (d.additional_works_data as string | null) ?? null,
  };
}
