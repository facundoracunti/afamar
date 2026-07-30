/**
 * EntityFormLayout — split into focused contexts to keep the prop
 * surface manageable. The two consuming pages (Budget and WorkOrder)
 * previously passed ~50 props; contexts collapse them into 4 slots plus
 * ~10 page-specific extras (render slots + observations + terms, etc.).
 *
 * Concerns:
 *   - `EntityFormStyleContext`     — CSS module lookup + BEM prefix.
 *   - `EntityFormStateContext`     — form state, setForm, update, readOnly,
 *                                    saving, logoUrl, M2_CONCEPTS.
 *   - `EntityFormDomainContext`    — reference data (clients, materials,
 *                                    pools) + the 9 CRUD handlers + USD
 *                                    rate mode + USD handlers.
 *   - `EntityFormActionsContext`   — submit, cancel, onConfirmarPago +
 *                                    delete-confirm flow + PDF preview +
 *                                    sketch/croquis toggle.
 */
import React, { createContext, useContext, type ReactNode } from 'react';
import type { EntityFormState, Client, ClientAddress, MaterialInForm } from '../../types';
import type { Material } from '../../types/material';
import type { Pool } from '../../types/poolStock';

// ─────────────────────────────────────────────────────────────────────────
// Style context
// ─────────────────────────────────────────────────────────────────────────
interface StyleCtxValue {
  styles: Record<string, string>;
  prefix: string;
}
const StyleCtx = createContext<StyleCtxValue | null>(null);
export function EntityFormStyleProvider({ value, children }: { value: StyleCtxValue; children: ReactNode }) {
  return <StyleCtx.Provider value={value}>{children}</StyleCtx.Provider>;
}
export function useEntityFormStyle(): StyleCtxValue {
  const ctx = useContext(StyleCtx);
  if (!ctx) throw new Error('useEntityFormStyle must be used inside EntityFormStyleProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────
// State context
// ─────────────────────────────────────────────────────────────────────────
interface StateCtxValue {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: string, value: unknown) => void;
  readOnly: boolean;
  saving: boolean;
  logoUrl: string;
  M2_CONCEPTS: string[];
}
const StateCtx = createContext<StateCtxValue | null>(null);
export function EntityFormStateProvider({ value, children }: { value: StateCtxValue; children: ReactNode }) {
  return <StateCtx.Provider value={value}>{children}</StateCtx.Provider>;
}
export function useEntityFormState(): StateCtxValue {
  const ctx = useContext(StateCtx);
  if (!ctx) throw new Error('useEntityFormState must be used inside EntityFormStateProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────
// Domain context (reference data + CRUD + USD)
// ─────────────────────────────────────────────────────────────────────────
export interface EntityFormDomainValue {
  // Reference data
  clientes: Client[];
  materials: Material[];
  pools: Pool[];

  // Clients
  addOrRefreshClientes: (client: Client) => void;
  onAddressAdded: (clientId: number, address: ClientAddress) => void;

  // Materials CRUD
  addMaterial: (name: string) => void;
  removeMaterial: (idx: number) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;

  // Pools CRUD
  addPileta: (id: string) => void;
  removePileta: (idx: number) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;

  // Fabrication details CRUD
  handleDetailChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;

  // USD / payment handlers
  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (currency: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
  /** Re-fetch the USD rate from the external API. */
  onUsdRateRefresh?: () => void;

  // Derived for the form
  formMaterials: MaterialInForm[];
}
const DomainCtx = createContext<EntityFormDomainValue | null>(null);
export function EntityFormDomainProvider({ value, children }: { value: EntityFormDomainValue; children: ReactNode }) {
  return <DomainCtx.Provider value={value}>{children}</DomainCtx.Provider>;
}
export function useEntityFormDomain(): EntityFormDomainValue {
  const ctx = useContext(DomainCtx);
  if (!ctx) throw new Error('useEntityFormDomain must be used inside EntityFormDomainProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────
// Actions context (submit, cancel, delete, pdf, sketch, croquis)
// ─────────────────────────────────────────────────────────────────────────
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
export interface EntityFormActionsValue {
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  onConfirmarPago?: () => Promise<void>;

  // Delete
  deleteConfirm: boolean;
  setDeleteConfirm: (v: boolean) => void;
  handleDelete: () => void;
  deleteTitle: string;
  deleteMessage: string;
  deleteConfirmLabel?: string;
  deleteDanger?: boolean;

  // PDF preview
  pdfData: PdfDocumentData | null;
  pdfPreviewLoading: boolean;
  handleClosePdfPreview: () => void;
  pdfTitle: string;
  pdfFileName: string;

  // Sketch image extractor (auto-screenshots the canvas for the PDF).
  sketchExtractorActive: boolean;
  handleSketchImagesReady: (images: string[]) => void;

  // Croquis toggle (sketch editor visibility).
  showCroquis: boolean;
  setShowCroquis: (v: boolean) => void;
}
const ActionsCtx = createContext<EntityFormActionsValue | null>(null);
export function EntityFormActionsProvider({ value, children }: { value: EntityFormActionsValue; children: ReactNode }) {
  return <ActionsCtx.Provider value={value}>{children}</ActionsCtx.Provider>;
}
export function useEntityFormActions(): EntityFormActionsValue {
  const ctx = useContext(ActionsCtx);
  if (!ctx) throw new Error('useEntityFormActions must be used inside EntityFormActionsProvider');
  return ctx;
}