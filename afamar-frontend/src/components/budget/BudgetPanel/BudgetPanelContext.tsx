import { createContext, useContext, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { EntityFormState, FormField } from '../../../types/form';
import type { PaymentMethod } from '../../../types/paymentMethod';

interface FinancialHandlers {
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (currency: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
}

interface UIState {
  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  readOnly: boolean;
  saving: boolean;
}

interface BudgetPanelContextValue {
  form: EntityFormState;
  setForm: Dispatch<SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  num: (v: string) => number | null;
  financial: FinancialHandlers;
  ui: UIState;
  onConfirmarPago?: () => Promise<void>;
  /** Active catalogue rows for the "Forma de pago" `<select>`.
   *  Optional — defaults to `[]` so legacy callers (and tests) that
   *  don't yet wire `useFormReferences` keep compiling. */
  paymentMethods?: PaymentMethod[];
}

const BudgetPanelContext = createContext<BudgetPanelContextValue | null>(null);

interface BudgetPanelProviderProps {
  children: ReactNode;
  form: EntityFormState;
  setForm: Dispatch<SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  num: (v: string) => number | null;
  financial: FinancialHandlers;
  ui: UIState;
  onConfirmarPago?: () => Promise<void>;
  /** Optional — legacy callers (and tests) that don't yet wire
   *  `useFormReferences.paymentMethods` pass nothing. The context
   *  defaults to `[]` so the consumer doesn't need to handle
   *  `undefined`. */
  paymentMethods?: PaymentMethod[];
}

export function BudgetPanelProvider({
  children,
  ...ctx
}: BudgetPanelProviderProps) {
  const value: BudgetPanelContextValue = { ...ctx, paymentMethods: ctx.paymentMethods ?? [] };
  return (
    <BudgetPanelContext.Provider value={value}>
      {children}
    </BudgetPanelContext.Provider>
  );
}

export function useBudgetPanel(): BudgetPanelContextValue {
  const ctx = useContext(BudgetPanelContext);
  if (!ctx) throw new Error('useBudgetPanel must be used inside BudgetPanelProvider');
  return ctx;
}
