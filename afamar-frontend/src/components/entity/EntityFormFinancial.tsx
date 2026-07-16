import { type ReactNode } from 'react';
import BudgetPanel from '../../components/budget/BudgetPanel/BudgetPanel';
import { BudgetPanelProvider } from '../../components/budget/BudgetPanel/BudgetPanelContext';
import type { EntityFormState, FormField } from '../../types/form';

interface EntityFormFinancialProps {
  form: EntityFormState;
  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  readOnly: boolean;
  saving: boolean;
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (currency: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  num: (v: string) => number | null;
  alternativasGrid?: ReactNode;
  discountBlock?: ReactNode;
  onConfirmarPago?: () => Promise<void>;
  sectionTitle?: string;
}

export default function EntityFormFinancial({
  form,
  modoUSD,
  toggleModoUSD,
  hayUSD,
  hayAlternativas,
  readOnly,
  saving,
  handleTransportChange,
  handleDepositCurrencyChange,
  handleDepositAmountChange,
  handleUsdRateChange,
  setForm,
  update,
  num,
  alternativasGrid,
  discountBlock,
  onConfirmarPago,
  sectionTitle = 'PRESUPUESTO',
}: EntityFormFinancialProps) {
  return (
    <BudgetPanelProvider
      form={form}
      setForm={setForm}
      update={update}
      num={num}
      financial={{
        handleTransportChange,
        handleDepositCurrencyChange,
        handleDepositAmountChange,
        handleUsdRateChange,
      }}
      ui={{
        modoUSD,
        toggleModoUSD,
        hayUSD,
        hayAlternativas,
        readOnly,
        saving,
      }}
      onConfirmarPago={onConfirmarPago}
    >
      <BudgetPanel
        alternativasGrid={alternativasGrid}
        hidePaymentSection={hayAlternativas}
        sectionTitle={sectionTitle}
        discountBlock={discountBlock}
      />
    </BudgetPanelProvider>
  );
}
