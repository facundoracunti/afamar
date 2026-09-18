// Budget form schema types. Field names are in English snake_case to match the backend API exactly.
// Source of truth: afamar-backend/app/schemas/budget.py (BudgetBase / BudgetCreate / BudgetUpdate).

import type { FinancialBase } from './shared';

export interface FabricationDetail {
  concept: string;
  detail: string;
  custom_concept?: string;
  material?: string;
  material_price_m2?: number;
  length: number | null;
  width: number | null;
  m2: number;
  labor: number | null;
  currency: 'ARS' | 'USD';
  quantity: number;
  price: number;
}

export interface BudgetItemSchema {
  id?: number;
  sector?: string;
  lengthUnit?: string;
  widthUnit?: string;
  length?: number;
  width?: number;
  m2?: number;
  quantity?: number;
  price_m2?: number;
  subtotal?: number;
}

export interface BudgetAdditionalSchema {
  id?: number;
  concept?: string;
  detail?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
}

export interface MaterialInForm {
  /** Catalogue `materials.id` for this material on the form snapshot. Optional
   *  for legacy rows that pre-date the Frente / Regrueso flow (when the
   *  snapshot only carried `name` + prices). The backend uses this for the
   *  `assigned_material_id` lookup so the formula has a real FK to resolve. */
  id?: number | null;
  name: string;
  category?: string;
  color?: string;
  price_m2: number;
  price_m2_usd: number;
  currency: 'ARS' | 'USD';
  quantity: number;
  m2_used: number;
  m2_budgeted: number;
  length: number;
  width: number;
  is_alternative: boolean;
  /** Whether the catalogue row allows an integrated sink ("BACHA
   *  INTEGRADA"). Copied from the catalogue so the additional-works picker
   *  can block incompatible materials even when the full `Material[]`
   *  catalogue isn't in scope. */
  allows_integrated_sink?: boolean;
}

/**
 * Sentinel value for the `material` field on `PoolInForm` that flags a pool
 * as "global" — i.e. the pool doesn't belong to any specific material/option
 * and should be rendered in the "EXTRAS / GLOBAL" section of the PDF,
 * contributing to the document grand total AND to each alternative's
 * subtotal (so the customer can compare alternatives apples-to-apples).
 *
 * Mirrors the "Global" option in `FabricationTable` for fabrication details.
 */
export const POOL_MATERIAL_GLOBAL = '__GLOBAL__' as const;

export interface PoolInForm {
  pool_id: number;
  brand: string;
  model: string;
  price: number;
  currency: 'ARS' | 'USD';
  image?: string;
  quantity: number;
  /**
   * Optional link to the material/alternative this pool belongs to:
   * - empty/undefined → main section (default — the pool is part of the
   *   principal option the customer is most likely to choose).
   * - `POOL_MATERIAL_GLOBAL` ('__GLOBAL__') → global / extras section
   *   (the pool is common to all options and adds to every subtotal).
   * - any other string → matches a material name and the pool is rendered
   *   inside that material's section in the PDF (so each alternative can
   *   carry its own sink).
   */
  material?: string;
  /** Dimensions of the specific mesada this pool is assigned to (filled by
   *  the PoolCard dropdown when the user picks a material row). When both
   *  are set, the Ficha de Taller renders "L X A MATERIAL" instead of just
   *  the material name — so workers know exactly which countertop the pool
   *  goes on. */
  mesada_length?: number;
  mesada_width?: number;
}

export interface BudgetPayload extends FinancialBase {
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  /** Optional override — when the customer wants the work done at a
   *  non-default address (e.g. an architect with several project sites).
   *  `null` means "use the client's default address". */
  delivery_address_id: number | null;
  material: string | null;
  material_price_m2: number;
  materials_data: string | null;
  color: string | null;
  thickness: string | null;
  finish: string | null;
  bacha: string | null;
  anafe: string | null;
  balance_paid: boolean;
  balance_paid_at: string | null;
  delivery_date: string | null;
  digital_signature: string | null;
  signed_at: string | null;
  design_observations: string | null;
  important_observations: string | null;
  notes: string | null;
  fabrication_details: string | null;
  pool_id: number | null;
  pool_price: number;
  pool_currency: string;
  pool_image: string | null;
  pools_data: string | null;
  items?: unknown[];
  additional_works?: unknown[];
  sketch_elements?: unknown[];
}

export interface UnifiedBudget {
  type: string;
  id: number;
  number: string;
  workOrderNumber?: string;
  date: string;
  clientName?: string;
  clientPhone?: string;
  materials?: Array<{ name: string }>;
  items?: Array<{ detail: string; material?: string }>;
  material?: string;
  designObservations?: string;
  total: number;
  status: string;
}

/** Exactly one principal material for a piece. `null` until the
 *  operator picks one from the catalogue. Type alias for readability —
 *  keeps the singular intent explicit at every callsite instead of
 *  repeating `MaterialInForm | null`. */
export type PieceMainMaterial = MaterialInForm | null;
/** A single alternative material row. Alternatives are kept as a flat
 *  array on the piece; the singular model means each piece carries at
 *  most one main + N alternatives. */
export type PieceAlternativeMaterial = MaterialInForm;
/**
 * A single countertop ("mesada") in the multi-piece budget flow.
 *
 * Pieces v3 (pieces-only mode): each piece owns exactly one main
 * material, a list of alternative materials, its own zócalo/frente rows,
 * its own additional works AND its own piletas. The piletas used to be a
 * document-global section but moved into the piece they belong to so a
 * "Mesada Cocina" and a "Mesada Baño" can each carry their own sink
 * without cross-contamination. A piece's piletas are inherited by every
 * alternative of that piece in the PDF, so swapping "Blanco Polar" for
 * "Blanco Suggar" still adds the same sink cost to the alternative's
 * subtotal.
 */
export interface BudgetPiece {
  id: string;
  /** Operator-facing label, e.g. "Mesada 1" / "Isla" / "Mueble cocina". */
  name: string;
  /** Exactly one principal material for this piece. `null` until the
   *  operator picks one ("AGREGAR MATERIAL" with no main yet sets it).
   *  Panes of the same material are encoded via `quantity` on this row,
   *  NOT as additional rows — this is the anchor row whose dims every
   *  alternative mirrors. */
  mainMaterial: PieceMainMaterial;
  /** Extra measurement rows ("tramos") of the SAME principal material.
   *  The primary `mainMaterial` is the anchor (prices/identity, dims
   *  mirrored by alternatives); each `mainMaterialRows` entry is an
   *  additional pane of the same physical material with its own
   *  Cantidad/Largo/Ancho. `flattenPieces` emits them all into
   *  `materials_data` (each flagged `is_alternative: false`), so totals /
   *  PDF / backend recalc sum every tramo of the piece's principal. */
  mainMaterialRows?: PieceAlternativeMaterial[];
  /** Alternative material options for this piece. Each carries
   *  `is_alternative: true` so the flat wire stays compatible with the
   *  legacy `materials_data` readers. */
  alternativeMaterials: PieceAlternativeMaterial[];
  /** Zócalo/frente rows for this piece, same shape as the global
   *  `fabrication_details`. */
  fabrication_details: FabricationDetail[];
  /** Additional-works snapshot for this piece, JSON-encoded exactly like
   *  the global `additional_works_data` (`AdditionalWorkSelection[]`). */
  additional_works_data: string;
  /** Pools (piletas) assigned to THIS piece. Moved out of the document
   *  globals so each piece can carry its own sink; the PDF inherits them
   *  into every alternative of the piece. */
  pools: PoolInForm[];
}
