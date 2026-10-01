/**
 * Panel informativo del modo "Dólar billete": muestra la cotización Dólar
 * Blue Intermedio y el equivalente en ARS del monto base a cobrar.
 */
import { formatCurrency } from '../utils/paymentFormat';

interface PaymentUsdPanelProps {
  amount: number;
  usdRate: number;
}

export function PaymentUsdPanel({ amount, usdRate }: PaymentUsdPanelProps) {
  return (
    <div
      style={{
        padding: '8px 12px',
        backgroundColor: 'rgb(239, 246, 255)',
        border: '1px solid rgb(191, 219, 254)',
        borderRadius: '6px',
        fontSize: '13px',
        color: 'rgb(30, 64, 175)',
      }}
    >
      <p style={{ margin: 0, fontWeight: 500 }}>
        Dólar billete — cotización Dólar Blue Intermedio:{' '}
        {formatCurrency(usdRate, 'ARS')} / USD
      </p>
      <p style={{ margin: '4px 0 0' }}>
        Equivalente en ARS:{' '}
        <strong>{formatCurrency(usdRate > 0 ? amount * usdRate : 0, 'ARS')}</strong>
      </p>
    </div>
  );
}