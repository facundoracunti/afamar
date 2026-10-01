/**
 * Resumen del total a registrar (foot del paso 1). Sin recargo muestra
 * "Monto a registrar:", con recargo "Total a cobrar (con recargo):" + la
 * descomposición `(base X + Y%)`.
 */
import { formatCurrency } from '../utils/paymentFormat';

interface PaymentTotalsSummaryProps {
  amount: number;
  amountFinal: number;
  surchargePercent: number;
  displayCurrency: 'ARS' | 'USD';
}

export function PaymentTotalsSummary({
  amount,
  amountFinal,
  surchargePercent,
  displayCurrency,
}: PaymentTotalsSummaryProps) {
  return (
    <div
      style={{
        padding: '8px 12px',
        backgroundColor: 'rgb(248, 250, 252)',
        borderRadius: '6px',
        fontSize: '14px',
      }}
    >
      <span style={{ color: 'rgb(71, 85, 105)' }}>
        {surchargePercent > 0 ? 'Total a cobrar (con recargo): ' : 'Monto a registrar: '}
      </span>
      <span style={{ fontWeight: 600, color: 'rgb(15, 23, 42)' }}>
        {formatCurrency(amountFinal, displayCurrency)}
      </span>
      {surchargePercent > 0 && (
        <span style={{ marginLeft: '8px', color: 'rgb(100, 116, 139)', fontSize: '12px' }}>
          (base {formatCurrency(amount, displayCurrency)} + {surchargePercent}%)
        </span>
      )}
    </div>
  );
}