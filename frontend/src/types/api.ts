import type { AxiosResponse } from 'axios';

export type ApiResponse<T> = Promise<AxiosResponse<T>>;

export interface PresupuestosApi {
  getPresupuestos: (params?: Record<string, unknown>) => ApiResponse<unknown[]>;
  getPresupuestosUnificados: (params?: Record<string, unknown>) => ApiResponse<unknown[]>;
  getPresupuesto: (id: number | string) => ApiResponse<unknown>;
  createPresupuesto: (data: unknown) => ApiResponse<unknown>;
  updatePresupuesto: (id: number | string, data: unknown) => ApiResponse<unknown>;
  deletePresupuesto: (id: number | string) => ApiResponse<void>;
  convertirAOrden: (id: number | string) => ApiResponse<unknown>;
  enviarPresupuestoWhatsApp: (id: number | string) => ApiResponse<unknown>;
  enviarPresupuestoEmail: (id: number | string) => ApiResponse<unknown>;
  getNextPresupuestoNumero: () => ApiResponse<{ numero: string }>;
  getPresupuestoPdf: (id: number | string) => string;
  convertirAlternativaAOrden: (presupuestoId: number | string, idx: number) => ApiResponse<unknown>;
}

export interface OrdenesApi {
  getOrdenes: (params?: Record<string, unknown>) => ApiResponse<unknown[]>;
  getOrden: (id: number | string) => ApiResponse<unknown>;
  createOrden: (data: unknown) => ApiResponse<unknown>;
  updateOrden: (id: number | string, data: unknown) => ApiResponse<unknown>;
  deleteOrden: (id: number | string) => ApiResponse<void>;
  getNextOrdenNumero: () => ApiResponse<{ numero: string }>;
  getOrdenPdf: (id: number | string) => string;
}
