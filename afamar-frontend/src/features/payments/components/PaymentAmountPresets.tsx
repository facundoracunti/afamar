/**
 * Selector de monto del paso 1: los 3 presets (Seña sugerida / Saldo
 * restante / Monto personalizado) + el input numérico del custom. Los estilos
 * inline blindan el layout contra cualquier override de Tailwind/CSS module
 * o de un `<fieldset>` (algunos browsers no aplican `flex` a fieldset
 * correctamente).
 */
import type { CSSProperties } from 'react';
import { INPUT_FIELD_STYLE } from './PaymentModal.styles';
import { formatCurrency, usdFromArs } from '../utils/paymentFormat';
import type { AmountPreset } from '../types/payment.types';

interface PaymentAmountPresetsProps {
  preset: AmountPreset;
  onPresetChange: (value: AmountPreset) => void;
  customAmount: string;
  onCustomAmountChange: (value: string) => void;
  seniaCumplida: boolean;
  remainingSeniaArs: number;
  saldoPendiente: number;
  isUsdMethod: boolean;
  usdRate: number;
  displayCurrency: 'ARS' | 'USD';
}

const RADIO_LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const RADIO_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  fontSize: '14px',
  color: 'rgb(51, 65, 85)',
  cursor: 'pointer',
};

const RADIO_INPUT_STYLE: CSSProperties = {
  marginTop: '2px',
  accentColor: '#2563eb',
  flexShrink: 0,
};

const CUSTOM_INPUT_STYLE: CSSProperties = {
  ...INPUT_FIELD_STYLE,
  marginTop: '8px',
};

export function PaymentAmountPresets({
  preset,
  onPresetChange,
  customAmount,
  onCustomAmountChange,
  seniaCumplida,
  remainingSeniaArs,
  saldoPendiente,
  isUsdMethod,
  usdRate,
  displayCurrency,
}: PaymentAmountPresetsProps) {
  const seniaSuggestedLabel = seniaCumplida
    ? 'ya completada'
    : formatCurrency(
        isUsdMethod ? usdFromArs(remainingSeniaArs, usdRate) : remainingSeniaArs,
        displayCurrency,
      );
  const saldoRestanteLabel = formatCurrency(
    isUsdMethod ? usdFromArs(saldoPendiente, usdRate) : saldoPendiente,
    displayCurrency,
  );

  return (
    <div>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: '14px',
          fontWeight: 500,
          color: 'rgb(51, 65, 85)',
        }}
      >
        Monto a registrar
      </p>
      <div style={RADIO_LIST_STYLE}>
        <label style={RADIO_ROW_STYLE}>
          <input
            type="radio"
            name="amount-preset"
            checked={preset === 'suggested_seña'}
            onChange={() => onPresetChange('suggested_seña')}
            disabled={seniaCumplida}
            style={RADIO_INPUT_STYLE}
          />
          <span>
            Seña sugerida{' '}
            <span style={{ color: 'rgb(100, 116, 139)' }}>({seniaSuggestedLabel})</span>
          </span>
        </label>
        <label style={RADIO_ROW_STYLE}>
          <input
            type="radio"
            name="amount-preset"
            checked={preset === 'remaining_balance'}
            onChange={() => onPresetChange('remaining_balance')}
            disabled={saldoPendiente <= 0}
            style={RADIO_INPUT_STYLE}
          />
          <span>
            Saldo restante{' '}
            <span style={{ color: 'rgb(100, 116, 139)' }}>({saldoRestanteLabel})</span>
          </span>
        </label>
        <label style={RADIO_ROW_STYLE}>
          <input
            type="radio"
            name="amount-preset"
            checked={preset === 'custom'}
            onChange={() => onPresetChange('custom')}
            style={RADIO_INPUT_STYLE}
          />
          <span>Monto personalizado</span>
        </label>
      </div>
      {preset === 'custom' && (
        <input
          type="number"
          min={0}
          step={0.01}
          value={customAmount}
          onChange={(e) => onCustomAmountChange(e.target.value)}
          placeholder="0.00"
          style={CUSTOM_INPUT_STYLE}
        />
      )}
    </div>
  );
}