import { createContext, useContext, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { EntityFormState, FormField } from '../../../types/form';

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
}

export function BudgetPanelProvider({
  children,
  ...ctx
}: BudgetPanelProviderProps) {
  return (
    <BudgetPanelContext.Provider value={ctx}>
      {children}
    </BudgetPanelContext.Provider>
  );
}

export function useBudgetPanel(): BudgetPanelContextValue {
  const ctx = useContext(BudgetPanelContext);
  if (!ctx) throw new Error('useBudgetPanel must be used inside BudgetPanelProvider');
  return ctx;
}
