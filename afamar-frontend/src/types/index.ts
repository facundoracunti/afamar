// Barrel re-export — all types use English names.
export type { Material, MaterialFormData } from './material';
export type { Client, ClientFormData, ClientHistory } from './client';
export type {
  FabricationDetail,
  BudgetItemSchema,
  BudgetAdditionalSchema,
  MaterialInForm,
  PoolInForm,
  BudgetPayload,
  UnifiedBudget,
} from './budget';
export type { WorkOrderPayload, ConvertOptionResponse } from './workOrder';
export type { OnlineBudgetItem, OnlineBudgetPayload } from './onlineBudget';
export type { Pool, PoolMovement } from './poolStock';
export type { Measurement, MeasurementFormData } from './measurement';
export type { CashMovement } from './cash';
export type { Setting, SettingsMap } from './settings';

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

// Product photos
export type { ProductPhoto, CreateProductPhotoData } from './product';
