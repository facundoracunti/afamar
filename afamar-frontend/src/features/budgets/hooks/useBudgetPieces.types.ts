/**
 * Types for the pieces-flow CRUD hook (`useBudgetPieces`). Extracted from
 * `useBudgetPieces.ts` so the hook stays a thin orchestrator and the
 * contract (params in / return out) lives here for both the hook and its
 * pure mutators in `useBudgetPieces.helpers.ts`.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { EntityFormState } from '@/types';
import type { Material } from '@/types/material';
import type { BudgetPiece, MaterialInForm } from '@/types/budget';

export interface UseBudgetPiecesParams {
  form: EntityFormState;
  setForm: Dispatch<SetStateAction<EntityFormState>>;
  materials: Material[];
}

export interface UseBudgetPiecesReturn {
  /** The form's pieces (always ≥ 1 — pieces-only mode). */
  pieces: BudgetPiece[];
  addPiece: () => void;
  removePiece: (id: string) => void;
  renamePiece: (id: string, name: string) => void;

  // ----- Main material (singular anchor + extra measurement rows)
  setPieceMain: (id: string, name: string) => void;
  updatePieceMain: (id: string, field: string, value: unknown) => void;
  swapPieceMain: (id: string, mat: Material) => void;
  removePieceMain: (id: string) => void;
  /** Add another measurement row ("tramo") of the same principal material.
   *  The passed row is used as the identity seed (name/prices/currency);
   *  the new row starts with blank dims, like the legacy addRow. */
  addPieceMainRow: (id: string, mat: MaterialInForm) => void;
  /** Update ONE main row by its position inside `[main, ...mainMaterialRows]`
   *  (idx 0 = the anchor, idx ≥ 1 = a tramo). */
  updatePieceMainRow: (id: string, idx: number, field: string, value: unknown) => void;
  /** Remove ONE main row by its position inside `[main, ...mainMaterialRows]`.
   *  Removing idx 0 (the anchor) when tramos exist promotes the first tramo
   *  to anchor so the piece never ends up with rows but no main. */
  removePieceMainRow: (id: string, idx: number) => void;
  /** Apply `field` to EVERY main row (anchor + tramos) — used by the card's
   *  shared price input so one edit prices the whole physical material. */
  updatePieceMainGroup: (id: string, field: string, value: unknown) => void;

  // ----- Alternative materials (grouped by material identity; one card
  // per material, with N panes/tramos inside).
  addPieceAlternative: (id: string, name: string) => void;
  /** Append a NEW pane (length/width/quantity blank) to the group with
   *  `groupKey` (= the alternative's id or name). Strictly LOCAL — does
   *  NOT touch the principal nor the other alternatives. */
  addPieceAlternativeRow: (id: string, groupKey: string, mat: MaterialInForm) => void;
  updatePieceAlternative: (id: string, groupKey: string, rowIdx: number, field: string, value: unknown) => void;
  /** Apply `field` to EVERY pane inside the same alternative card
   *  (shared price input). */
  updatePieceAlternativeGroup: (id: string, groupKey: string, field: string, value: unknown) => void;
  swapPieceAlternative: (id: string, groupKey: string, mat: Material) => void;
  /** Remove the WHOLE alternative card (all panes with the same
   *  groupKey). Use `removePieceAlternativeRow` for a single pane. */
  removePieceAlternative: (id: string, groupKey: string) => void;
  removePieceAlternativeRow: (id: string, groupKey: string, rowIdx: number) => void;
  togglePieceAlternative: (id: string, groupKey: string) => void;

  // ----- Piece fabrication (zócalo/frente) rows
  addPieceFabrication: (id: string) => void;
  updatePieceFabrication: (id: string, idx: number, field: string, value: unknown) => void;
  removePieceFabrication: (id: string, idx: number) => void;

  // ----- Piece additional works (JSON snapshot)
  setPieceAdditionalWorks: (id: string, json: string) => void;

  // ----- Piece pools (piletas belong to the piece, not the document)
  addPiecePool: (id: string, poolId: number | string) => void;
  updatePiecePool: (id: string, idx: number, field: string, value: unknown) => void;
  removePiecePool: (id: string, idx: number) => void;
  setPiecePoolFields: (id: string, idx: number, fields: Record<string, unknown>) => void;
}