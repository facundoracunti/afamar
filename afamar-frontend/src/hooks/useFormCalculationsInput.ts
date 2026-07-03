import { useCallback } from 'react';
import type { EntityFormState } from '../types';

interface UseFormCalculationsInputParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
}

interface UseFormCalculationsInputReturn {
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (currency: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
}

/**
 * Composable: handlers for the "input" side of the financial calculations
 * (transport, deposit, USD rate). The "calculation" side (subtotal, total,
 * balance_due, ...) lives in `useBudgetCalculations`.
 *
 * All four handlers keep the ARS / USD pair in sync via the current
 * `usd_rate`.
 */
export function useFormCalculationsInput({
  form,
  setForm,
}: UseFormCalculationsInputParams): UseFormCalculationsInputReturn {
  const handleTransportChange = useCallback(
    (value: string, source: 'ars' | 'usd') => {
      const dd = Number(form.usd_rate);
      if (source === 'usd') {
        const usd = Number(value) || 0;
        const ars = Math.round(usd * dd * 100) / 100;
        setForm((prev) => ({ ...prev, transport_usd: usd, transport: ars }));
      } else {
        const ars = Number(value) || 0;
        const usd = dd > 0 ? Math.round((ars / dd) * 100) / 100 : 0;
        setForm((prev) => ({ ...prev, transport: ars, transport_usd: usd }));
      }
    },
    [form.usd_rate]
  );

  const handleDepositCurrencyChange = useCallback(
    (currency: string) => {
      setForm((prev) => ({
        ...prev,
        deposit_currency: currency,
        deposit_received: currency === 'ARS' ? Number(prev.deposit_received) : 0,
        deposit_usd: currency === 'USD' ? Number(prev.deposit_usd) : 0,
      }));
    },
    []
  );

  const handleDepositAmountChange = useCallback(
    (value: string) => {
      const val = Number(value) || 0;
      const currency = form.deposit_currency || 'ARS';
      setForm((prev) => ({
        ...prev,
        deposit_received: currency === 'ARS' ? val : 0,
        deposit_usd: currency === 'USD' ? val : 0,
      }));
    },
    [form.deposit_currency]
  );

  const handleUsdRateChange = useCallback(
    (value: string) => {
      const dd = Number(value);
      const tr_usd = Number(form.transport_usd) || 0;
      setForm((prev) => ({
        ...prev,
        usd_rate: dd,
        transport: Math.round(tr_usd * dd * 100) / 100,
      }));
    },
    [form.transport_usd]
  );

  return {
    handleTransportChange,
    handleDepositCurrencyChange,
    handleDepositAmountChange,
    handleUsdRateChange,
  };
}