import type { FabricacionDetalle, MaterialEnForm, PiletaEnForm } from './presupuesto';

export interface EntityFormState {
  numero: string;
  cliente_nombre: string;
  cliente_telefono_orden: string;
  domicilio: string;
  email: string;
  fecha: string;
  estado: string;
  material: string;
  material_precio_m2: number;
  color_tipo: string;
  espesor: string;
  acabado: string;
  tipo_cambio: number;
  bacha: string;
  anafe: string;
  croquis: unknown[];
  observaciones_diseno: string;
  detalles_fabricacion: FabricacionDetalle[];
  pileta_id: number | string;
  pileta_imagen: string;
  pileta_precio: number;
  pileta_moneda: string;
  subtotal: number;
  traslado: number;
  traslado_usd: number;
  total: number;
  sena_recibida: number;
  sena_moneda: string;
  saldo_pendiente: number;
  forma_pago: string;
  cuotas: number;
  saldo_pagado: boolean;
  fecha_pago_saldo: string;
  dolar_dia: number;
  subtotal_usd: number;
  total_usd: number;
  sena_usd: number;
  saldo_pendiente_usd: number;
  fecha_entrega: string;
  firma_cliente: string | null;
  fecha_aprobacion: string;
  observaciones: string;
  observaciones_importantes: string;
  detalles_presupuestados: FabricacionDetalle[];
  materiales: MaterialEnForm[];
  piletas: PiletaEnForm[];
  orden_trabajo_numero: string | null;
  descuento_porcentaje: number;
  descuento_monto_fijo: number;
  recargo_ars: number;
  recargo_usd: number;
  recargo_pct: number;
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
  getMateriales: (params?: Record<string, unknown>) => ApiPromise;
  getPiletas: (params?: Record<string, unknown>) => ApiPromise;
  getClientes: (params?: Record<string, unknown>) => ApiPromise;
  getPdfUrl?: (id: number | string) => string;
  listPath: string;
}

export interface UseEntityFormParams {
  entityType: string;
  services: EntityServices;
  defaultEstado: string;
  id?: string;
  navigate: (path: string) => void;
  onLoaded?: (data: Record<string, unknown>) => void;
}

export interface UseEntityFormReturn {
  form: EntityFormState;
  loading: boolean;
  saving: boolean;
  materiales: Record<string, unknown>[];
  piletas: Record<string, unknown>[];
  clientes: Record<string, unknown>[];
  logoUrl: string;
  showClienteDropdown: boolean;
  menuOpen: boolean;
  deleteConfirm: boolean;
  showCroquis: boolean;
  modoUSD: boolean;
  toggleModoUSD: () => void;
  setModoUSD: React.Dispatch<React.SetStateAction<boolean>>;
  readOnly: boolean;
  hayUSD: boolean;
  hayAlternativas: boolean;
  clientesFiltrados: unknown[];
  isEdit: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  clienteRef: React.RefObject<HTMLDivElement | null>;
  materialPrecioRef: React.MutableRefObject<number>;
  materialUsdRef: React.MutableRefObject<number>;
  materialesAgrupados: unknown[];
  CONCEPTOS_M2: string[];
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  setShowClienteDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCroquis: React.Dispatch<React.SetStateAction<boolean>>;
  update: (field: FormField, value: unknown) => void;
  handleMaterialChange: (nombre: string) => void;
  handleClienteSelect: (c: Record<string, unknown>) => void;
  handlePiletaImagen: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTrasladoChange: (value: string, source: 'ars' | 'usd') => void;
  handleSenaMonedaChange: (moneda: string) => void;
  handleSenaMontoChange: (value: string) => void;
  handleDolarDiaChange: (value: string) => void;
  handleDetalleChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
  addMaterial: (nombre: string) => void;
  removeMaterial: (idx: number) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  addPileta: (pid: string) => void;
  removePileta: (idx: number) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  handleDelete: () => Promise<void>;
  handleCambioEstadoAccion: (nuevoEstado: string) => Promise<void>;
  handlePrint: () => void;
  buildPayload: () => Record<string, unknown>;
}
