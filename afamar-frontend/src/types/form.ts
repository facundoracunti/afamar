import type { FabricationDetail, MaterialInForm, PoolInForm } from './budget';
import type { Client } from './client';
import type { Material } from './material';
import type { Pool } from './poolStock';
import type { FinancialBase } from './shared';

export interface EntityFormState extends FinancialBase {
  // Client info — matches BudgetBase.client_*
  client_name: string;
  client_phone: string;
  client_address: string;
  client_email: string;
  /**
   * Optional override — id of the `ClientAddress` row to use for the
   * delivery address on this document. `null` means "use the client's
   * default address" (backed by `Client.address`).
   */
  delivery_address_id: number | null;

  // Budget/work order identifier & status
  number: string;
  date: string;
  status: string;

  // Material specs
  material: string;
  material_price_m2: number;
  color: string;
  thickness: string;
  finish: string;
  bacha: string;
  anafe: string;
  pool_id: number | string;
  pool_price: number;
  pool_currency: string;
  pool_image: string;

  // Balance payment is form-only (the backend tracks it on work orders via
  // snapshot fields, but the form wants the boolean + date as-is).
  balance_paid: boolean;
  balance_paid_at: string;

  // Dates & signature
  delivery_date: string;
  digital_signature: string | null;
  signed_at: string;

  // Observations
  notes: string;
  design_observations: string;
  important_observations: string;

  // Per-budget/per-work-order term overrides (shown as a list in the PDF).
  // Always serialized as a JSON-encoded string on the API boundary.
  // Empty list → empty string → backend falls back to the global config terms.
  budget_terms: string[];
  warranty_terms: string[];
  delivery_terms: string[];

  // Fabrication
  fabrication_details: FabricationDetail[];

  // Arrays (sent as *_data JSON to API)
  materials_data: MaterialInForm[];
  pools_data: PoolInForm[];
  sketch_elements: unknown[];
  // JSON-encoded list of selected additional works from the catalogue.
  // `null` means "no additional works selected" (vs `''` which would be
  // malformed). The service round-trips this through the `additional_works_data`
  // TEXT column on the budget / work-order row.
  additional_works_data: string | null;



  // Client-side only
  work_order_number: string | null;

  // Form-only metadata — not part of the wire payload. ISO timestamp of
  // when the USD rate was last fetched from the external API. Used by the
  // PDF builder to print "Dólar del día (DD/MM HH:mm)" next to the rate.
  usd_rate_fetched_at?: string;
}

export type FormField = keyof EntityFormState;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiPromise = Promise<Record<string, any>>;

export interface EntityServices {
  getById: (id: number | string) => ApiPromise;
  create: (data: Record<string, unknown>) => ApiPromise;
  update: (id: number | string, data: Record<string, unknown>) => ApiPromise;
  delete: (id: number | string) => ApiPromise;
  getNextNumero?: () => ApiPromise;
  getMaterials: (params?: Record<string, unknown>) => ApiPromise;
  getPools: (params?: Record<string, unknown>) => ApiPromise;
  getClients: (params?: Record<string, unknown>) => ApiPromise;
  getPdfUrl?: (id: number | string) => string;
  listPath: string;
}

export interface UseEntityFormParams {
  services: EntityServices;
  defaultStatus: string;
  id?: string;
  navigate: (path: string) => void;
  onLoaded?: (data: Record<string, unknown>) => void;
}

export interface UseEntityFormReturn {
  form: EntityFormState;
  loading: boolean;
  saving: boolean;
  materials: Material[];
  pools: Pool[];
  clientes: Client[];
  /**
   * Prepend a freshly-created client to the local cache (preferred — keeps
   * the form values untouched). When called with no arguments, refetches
   * the full client list from the API.
   */
  addOrRefreshClientes: (newClient?: Client) => void;
  updateClientAddresses: (clientId: number, addresses: Client['addresses']) => void;
  logoUrl: string;
  showClientDropdown: boolean;
  menuOpen: boolean;
  deleteConfirm: boolean;
  showCroquis: boolean;
  modoUSD: boolean;
  toggleModoUSD: () => void;
  setModoUSD: React.Dispatch<React.SetStateAction<boolean>>;
  readOnly: boolean;
  hayUSD: boolean;
  hayAlternativas: boolean;
  filteredClients: Client[];
  isEdit: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  clientRef: React.RefObject<HTMLDivElement | null>;
  materialPrecioRef: React.MutableRefObject<number>;
  materialUsdRef: React.MutableRefObject<number>;
  /** Materials filtered to entries that have a usable `name` (drops any
   *  legacy rows that pre-date the form snapshot). */
  groupedMaterials: Material[];
  M2_CONCEPTS: string[];
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  setShowClientDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCroquis: React.Dispatch<React.SetStateAction<boolean>>;
  update: (field: FormField, value: unknown) => void;
  handleMaterialChange: (name: string) => void;
  handleClientSelect: (c: Record<string, unknown>) => void;
  handlePoolImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (currency: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
  handleDetailChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
  addMaterial: (name: string) => void;
  removeMaterial: (idx: number) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  /** Add another measurement row of an already-selected material (keeps
   *  `materials_data` flat — the MaterialCard renders one card per
   *  material with N rows grouped in the UI layer). */
  addMaterialRow: (mat: MaterialInForm) => void;
  /** Remove every row whose global index is in `idxs` (a whole card). */
  removeMaterialGroup: (idxs: number[]) => void;
  /** Set `field` on every row whose global index is in `idxs` in a single
   *  state update (e.g. toggling the "Alternativa" checkbox on a card). */
  updateMaterialGroup: (idxs: number[], field: string, value: unknown) => void;
  /** Replace the catalogue identity (name/color/prices/currency) of every
   *  row whose global index is in `idxs` (a whole card), keeping each
   *  row's measurements and alternative flag. */
  swapMaterialGroup: (idxs: number[], mat: Material) => void;
  addPileta: (pid: string) => void;
  removePileta: (idx: number) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<boolean>;
  handleDelete: () => Promise<void>;
  handleStatusChangeAction: (newStatus: string) => Promise<void>;
  handlePrint: () => void;
  buildPayload: () => Record<string, unknown>;
}