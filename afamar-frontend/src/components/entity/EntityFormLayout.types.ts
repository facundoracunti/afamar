/**
 * Types of the shared entity form layout.
 *
 * `EntityFormLayoutProps` is the PUBLIC prop surface. It lives here so the
 * orchestrator (`EntityFormLayout.tsx`) stays thin, and it is re-exported
 * from there so every consumer keeps importing it from the same place.
 *
 * `EntityFormLayoutSlots` is INTERNAL: the bundle of page-specific nodes
 * (render slots + derived nodes) shared by every sub-block of the layout
 * (bottom stack, legacy columns and the wizard steps).
 */
import type { ReactNode } from 'react';
import type { MaterialInForm } from '../../types';
import type { UseBudgetPiecesReturn } from '@features/budgets/hooks/useBudgetPieces';

export interface TermConfig {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  hint?: string;
  disabled: boolean;
}

/**
 * Public API. Most state/handlers are consumed from the 4 contexts set up
 * by the consuming page. The slots below are page-specific extras:
 *
 *   - `beforeLayout`, `observations`, `extraDialogs` — render slots
 *   - `terms` — per-page list of term editor cards (Budget = none,
 *     WorkOrder = delivery + warranty)
 *   - `alternativasGrid` — only set by the Budget page
 *   - `specsCardClassName`, `fabricationShowMeasurementComparison` —
 *     `fabricationMaterialsData` — small layout/materialisation overrides
 *
 * The BudgetFormPage and WorkOrderFormPage wrap this component in the
 * 4 `EntityFormXxxProvider`s from `EntityFormContexts.tsx`.
 */
export interface EntityFormLayoutProps {
  beforeLayout?: ReactNode;
  observations?: ReactNode;
  terms?: TermConfig[];
  alternativasGrid?: ReactNode;
  /** Slot para acciones primarias (ej: "CONVERTIR A ORDEN"). */
  actionBlock?: ReactNode;
  extraDialogs?: ReactNode;
  specsCardClassName?: string;
  fabricationShowMeasurementComparison?: boolean;
  fabricationMaterialsData?: MaterialInForm[];
  mode?: 'full' | 'wizard';
  /**
   * Pieces v3: budgets AND work orders render in pieces-only mode. This
   * flag exists so a legacy consumer could still opt into the flat
   * single-mesada layout — currently nothing sets it to false.
   */
  showPieces?: boolean;
  /** Required when `showPieces` is true. Comes from `useEntityForm().piecesFlow`. */
  piecesFlow?: UseBudgetPiecesReturn;
  /** Slot para la sección de cobros. La página de presupuestos NO la pasa
   *  (cotización pura: sin Traslado/Forma de pago/Fechas). `WorkOrderFormPage`
   *  la enchufa con `<WorkOrderPaymentSection .../>` para desacoplar el
   *  cobro de la OT del resto del flujo del presupuesto. */
  paymentSection?: ReactNode;
}

/**
 * Internal bundle shared by every sub-block of the layout. `EntityFormLayout`
 * assembles it once from its own props + the contexts and hands it down, so
 * the bottom stack, the legacy columns and the wizard steps always render
 * exactly the same nodes.
 */
export interface EntityFormLayoutSlots {
  /** Slot rendered right after the client card (page-specific cards). */
  beforeLayout: ReactNode;
  /** Slot rendered above the terms cards (notes of the document). */
  observations: ReactNode;
  /** Per-page list of term editor cards. */
  terms: TermConfig[];
  /** Pre-rendered term cards used by the wizard "review" step. */
  wizardTerms: ReactNode;
  /** Grid of alternative-material cards (Budget page). */
  alternativasGrid: ReactNode;
  /** Primary actions rendered under the totals column. */
  actionBlock: ReactNode;
  /** Slot for the payment/collection section (WorkOrder page). */
  paymentSection: ReactNode;
  /** Confirm-payment handler forwarded to the totals column. */
  onConfirmarPago?: () => Promise<void>;
  /** Porcelain calculator, opened by default (wizard step). */
  porcelainCalculator: ReactNode;
  /** Porcelain calculator, collapsed by default (bottom stack). */
  porcelainCalculatorCollapsed: ReactNode;
  /** Unique material names used to label the sketch pages. */
  sketchMaterials: string[];
}
