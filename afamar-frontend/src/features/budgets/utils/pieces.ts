/**
 * Multi-piece budget helpers.
 *
 * A "piece" (mesada) owns its own materials (one principal + N
 * alternativas), its own zócalo/frente rows, its own additional works AND
 * its own piletas. `pieces_data` is the source of truth; the legacy
 * document-level arrays (`materials_data`, `fabrication_details`,
 * `additional_works_data`, `pools_data`) are still what the
 * totals / card surcharge / cash formulas consume. `flattenPieces`
 * bridges the two: it concatenates every piece's sub-arrays into the
 * legacy arrays so nothing downstream has to know about pieces.
 *
 * Pieces v3 (pieces-only mode, the default everywhere in the app)
 * guarantees the form always has at least one piece. `normalisePieces`
 * returns at least one piece — when the payload is empty / missing it
 * collapses to a single empty piece — so the operator never sees an
 * empty form with no way to add the first material.
 */

import type {
  BudgetPiece,
  FabricationDetail,
  MaterialInForm,
  PoolInForm,
} from '@/types/budget';

/** Stable-enough unique id for a piece (no crypto dependency). */
function pieceId(): string {
  return `piece-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A brand-new, empty piece named "Mesada N" (N = current count + 1). */
export function createEmptyPiece(existingCount: number): BudgetPiece {
  return {
    id: pieceId(),
    name: `Mesada ${existingCount + 1}`,
    mainMaterial: null,
    alternativeMaterials: [],
    fabrication_details: [],
    additional_works_data: '[]',
    pools: [],
  };
}

export interface FlattenedPieces {
  materials_data: MaterialInForm[];
  fabrication_details: FabricationDetail[];
  additional_works_data: string;
  pools_data: PoolInForm[];
}

/** Parse a piece's additional-works JSON into a plain array (never throws). */
function parseAdditionalWorks(json: string | null | undefined): unknown[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Normalise a single persisted piece into the current `BudgetPiece` shape.
 * Handles BOTH the new `{mainMaterial, alternativeMaterials, pools, …}`
 * shape AND the legacy `{materials[]}` shape persisted by older sessions
 * (where alternatives were encoded with `is_alternative: true` on each
 * material row). Legacy pieces are migrated in-place: the first
 * non-alternative row becomes `mainMaterial`, the rest become
 * `alternativeMaterials`, the rows keep their dims (multiple mains
 * collapse into the first main's row with summed `quantity`).
 */
export function normalisePiece(raw: unknown, index = 0): BudgetPiece {
  if (!raw || typeof raw !== 'object') return createEmptyPiece(index);
  const r = raw as {
    id?: string;
    name?: string;
    mainMaterial?: MaterialInForm | null;
    alternativeMaterials?: MaterialInForm[];
    materials?: MaterialInForm[];
    fabrication_details?: FabricationDetail[];
    additional_works_data?: string;
    pools?: PoolInForm[];
  };

  // New shape already? (Pieces v2/v3)
  if (Array.isArray(r.alternativeMaterials) || r.mainMaterial !== undefined) {
    const main = r.mainMaterial && typeof r.mainMaterial === 'object'
      ? { ...(r.mainMaterial as MaterialInForm), is_alternative: false }
      : null;
    const alts = Array.isArray(r.alternativeMaterials)
      ? r.alternativeMaterials.map((m) => ({ ...m, is_alternative: true }))
      : [];
    return {
      id: r.id || pieceId(),
      name: r.name || `Mesada ${index + 1}`,
      mainMaterial: main,
      alternativeMaterials: alts,
      fabrication_details: Array.isArray(r.fabrication_details) ? r.fabrication_details : [],
      additional_works_data:
        typeof r.additional_works_data === 'string' ? r.additional_works_data : '[]',
      pools: Array.isArray(r.pools) ? r.pools : [],
    };
  }

  // Legacy shape: `materials[]` with `is_alternative: true` flag.
  const allMats = Array.isArray(r.materials) ? r.materials : [];
  const firstMain = allMats.find((m) => !m.is_alternative) || null;
  const alts = allMats
    .filter((m) => m.is_alternative)
    .map((m) => ({ ...m, is_alternative: true }));
  let main: MaterialInForm | null = firstMain
    ? { ...firstMain, is_alternative: false }
    : null;
  // Fold additional "panes" of the principal material into the main row's
  // `quantity` so the singular model still represents them. The extra
  // panes' dimensions are dropped — the operator can re-split later if
  // they need differently-sized panes.
  const otherMains = allMats.filter((m) => !m.is_alternative).slice(1);
  if (main && otherMains.length > 0) {
    let totalQty = Number(main.quantity || 1);
    let totalArea =
      Number(main.length || 0) * Number(main.width || 0) * totalQty;
    for (const extra of otherMains) {
      const q = Number(extra.quantity || 1);
      totalQty += q;
      totalArea += Number(extra.length || 0) * Number(extra.width || 0) * q;
    }
    main = { ...main, quantity: totalQty };
    void totalArea;
  }

  return {
    id: r.id || pieceId(),
    name: r.name || `Mesada ${index + 1}`,
    mainMaterial: main,
    alternativeMaterials: alts,
    fabrication_details: Array.isArray(r.fabrication_details) ? r.fabrication_details : [],
    additional_works_data:
      typeof r.additional_works_data === 'string' ? r.additional_works_data : '[]',
    pools: Array.isArray(r.pools) ? r.pools : [],
  };
}

/**
 * Normalise an entire `pieces_data` payload (array or JSON string).
 * Pieces v3 guarantees ≥ 1 piece, so an empty / missing payload collapses
 * to a single empty piece rather than `[]`.
 */
export function normalisePieces(raw: unknown): BudgetPiece[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = [];
    }
  }
  const normalised = arr.map((p, i) => normalisePiece(p, i));
  return normalised.length > 0 ? normalised : [createEmptyPiece(0)];
}

/**
 * Concatenate every piece's sub-arrays into the legacy document-level
 * arrays. The order is piece order, so the PDF / totals stay
 * deterministic. `additional_works_data` is re-serialised as a single
 * JSON array string.
 */
export function flattenPieces(
  pieces: BudgetPiece[] | null | undefined,
): FlattenedPieces {
  const materials_data: MaterialInForm[] = [];
  const fabrication_details: FabricationDetail[] = [];
  const pools_data: PoolInForm[] = [];
  const additional: unknown[] = [];

  for (const piece of pieces || []) {
    if (!piece) continue;
    if (piece.mainMaterial) {
      materials_data.push({ ...piece.mainMaterial, is_alternative: false });
    }
    if (Array.isArray(piece.alternativeMaterials)) {
      for (const alt of piece.alternativeMaterials) {
        materials_data.push({ ...alt, is_alternative: true });
      }
    }
    if (Array.isArray(piece.fabrication_details)) {
      fabrication_details.push(...piece.fabrication_details);
    }
    if (Array.isArray(piece.pools)) {
      pools_data.push(...piece.pools);
    }
    additional.push(...parseAdditionalWorks(piece.additional_works_data));
  }

  return {
    materials_data,
    fabrication_details,
    additional_works_data: JSON.stringify(additional),
    pools_data,
  };
}

/** Total surface (m²) of every material across the pieces. */
export function piecesTotalM2(pieces: BudgetPiece[] | null | undefined): number {
  let total = 0;
  for (const piece of pieces || []) {
    if (!piece) continue;
    const all = [piece.mainMaterial, ...(piece.alternativeMaterials || [])].filter(
      Boolean,
    ) as MaterialInForm[];
    for (const m of all) {
      total +=
        Number(m.length || 0) *
        Number(m.width || 0) *
        Number(m.quantity || 1);
    }
  }
  return total;
}
