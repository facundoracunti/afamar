import { type ReactNode } from 'react';
import BudgetPanel from '../../components/budget/BudgetPanel/BudgetPanel';
import { BudgetPanelProvider } from '../../components/budget/BudgetPanel/BudgetPanelContext';
import type { EntityFormState, FormField } from '../../types/form';
import type { PaymentMethod } from '../../types/paymentMethod';

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
  /** Re-fetch the USD rate from the external API. Wired to the
   *  refresh button next to the "Dólar del día" field. */
  onUsdRateRefresh?: () => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  num: (v: string) => number | null;
  alternativasGrid?: ReactNode;
  discountBlock?: ReactNode;
  /** Slot para acciones primarias (ej: "CONVERTIR A ORDEN"). Renderizado
   *  debajo de Traslado/Seña. */
  actionBlock?: ReactNode;
  onConfirmarPago?: () => Promise<void>;
  sectionTitle?: string;
  /** Active payment-method catalogue rows. Sourced from
   *  `useFormReferences` (5 min staleTime) and forwarded to the
   *  "Forma de pago" `<select>`. */
  paymentMethods: PaymentMethod[];
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
  onUsdRateRefresh,
  setForm,
  update,
  num,
  alternativasGrid,
  discountBlock,
  actionBlock,
  onConfirmarPago,
  sectionTitle = 'PRESUPUESTO',
  paymentMethods,
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
      paymentMethods={paymentMethods}
    >
      <BudgetPanel
        alternativasGrid={alternativasGrid}
        sectionTitle={sectionTitle}
        discountBlock={discountBlock}
        actionBlock={actionBlock}
        onUsdRateRefresh={onUsdRateRefresh}
      />
    </BudgetPanelProvider>
  );
}
