/**
 * Formatting, parsing and lookup helpers for PDF data construction.
 */

export const CONCEPT_DISPLAY: Record<string, string> = {
  BASEBOARD: 'Zócalo',
  FRONT: 'Frente',
  LENGTH: 'Longitud',
  ZOCALOS: 'Zócalos',
  CUTOUT_SINK: 'Traforo de Pileta',
  CUTOUT_COOKTOP: 'Traforo de Anafe',
  CUTOUT_DROPIN_SINK: 'Traforo de Pileta de Apoyo',
  'PILETA MOD': 'Pileta Mod.',
  TERMINACION: 'Terminación',
  OTHER: 'Otro',
};

export const STATUS_SUB_MAP: Record<string, string> = {
  PENDING: 'Pendiente',
  ONLINE: 'Online',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CONVERTED_TO_OT: 'Convertido a OT',
  MEASUREMENT: 'Medición',
  WORKSHOP: 'En Taller',
  FINISHED: 'Finalizado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const M2_CONCEPTS = new Set(['LENGTH', 'BASEBOARD', 'FRONT', 'LARGO', 'ZOCALOS', 'FRENTE']);
export const UNIT_CONCEPTS = new Set([
  'CUTOUT_SINK',
  'CUTOUT_COOKTOP',
  'CUTOUT_DROPIN_SINK',
  'PILETA MOD',
  'TRAFORO_PILETA',
  'TRAFORO_ANAFE',
  'TRAFORO_PILETA_APOYO',
]);
export const LINEAR_CONCEPTS = new Set(['TERMINACION']);

export function formatDate(d: unknown): string {
  if (!d) return new Date().toLocaleDateString('es-AR');
  const s = String(d);
  try {
    return new Date(s.slice(0, 10)).toLocaleDateString('es-AR');
  } catch {
    return s;
  }
}

export function fmtNum(value: unknown, decimals = 2): string {
  let n: number;
  if (typeof value === 'number') n = value;
  else if (value == null || value === '') n = 0;
  else n = Number(value);
  if (!Number.isFinite(n)) n = 0;
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtMoney(value: unknown): string {
  return fmtNum(value, 2);
}

export function fmtUnit(value: unknown, decimals = 2, suffix = ''): string {
  return `${fmtNum(value, decimals)} ${suffix}`.trim();
}

export function conceptToDisplay(conceptCode: string, custom = ''): string {
  if (conceptCode === 'OTHER' && custom) return custom;
  return CONCEPT_DISPLAY[conceptCode] || conceptCode || '—';
}

export function parseJsonList(raw: unknown): unknown[] {
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

export function splitTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  if (value == null) return [];
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
    } catch {
      /* fallthrough to legacy mode */
    }
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
