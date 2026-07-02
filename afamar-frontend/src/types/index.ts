// Barrel re-export. New code should import English names. Spanish
// aliases are kept for backward compatibility — see individual files
// in this folder for the deprecation notes.

export type { Material, MaterialFormData } from './material';

// English names (preferred)
export type { Client, ClientFormData, ClientHistory } from './client';

// Spanish aliases (deprecated, but still supported)
export type { Cliente, ClienteFormData } from './cliente';

// Budget types
export type {
  FabricationDetail,
  BudgetItemSchema,
  BudgetAdditionalSchema,
  MaterialInForm,
  PoolInForm,
  BudgetPayload,
  UnifiedBudget,
} from './budget';

// Spanish aliases
export type {
  FabricacionDetalle,
  PresupuestoItemSchema,
  PresupuestoAdicionalSchema,
  MaterialEnForm,
  PiletaEnForm,
  PresupuestoPayload,
  PresupuestoUnificado,
} from './presupuesto';

// Work order types
export type { WorkOrderPayload, ConvertOptionResponse } from './workOrder';

// Spanish aliases
export type { OrdenTrabajoPayload, ConvertirOpcionResponse } from './orden';

// Online budget types
export type { OnlineBudgetItem, OnlineBudgetPayload } from './onlineBudget';

// Spanish aliases
export type { PresupuestoOnlineItem, PresupuestoOnlinePayload } from './presupuestoOnline';

// Pool stock
export type { Pool, PoolMovement } from './poolStock';

// Spanish aliases
export type { StockPileta, MovimientoPileta } from './stockPileta';

// Measurement
export type { Measurement, MeasurementFormData } from './measurement';

// Spanish alias
export type { Medicion, MedicionFormData } from './medicion';

// Cash
export type { CashMovement } from './cash';

// Spanish alias
export type { MovimientoCaja } from './caja';

// Settings
export type { Setting, SettingsMap } from './settings';

// Spanish alias
export type { Configuracion } from './configuracion';

// Form
export type {
  EntityFormState,
  EntityServices,
  FormField,
  UseEntityFormParams,
  UseEntityFormReturn,
} from './form';

// Croquis
export type { CroquisElement, CroquisPage, CroquisEditorProps } from './croquis';

// Auth
export type { User, LoginCredentials, AuthResponse } from './auth';

// API
export type { ApiResponse } from './api';

// Dashboard
export type { DashboardData, BudgetSummary, OrderSummary, PoolSummary } from './dashboard';

// Completed works (renamed from TrabajoRealizado)
export type { CompletedWork } from './completedWorks';
