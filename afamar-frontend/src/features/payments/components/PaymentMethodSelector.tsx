import type { PaymentMethod } from '../types/payment.types';

const METHOD_OPTIONS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'payway_link', label: 'Link de pago (Payway)' },
];

export interface PaymentMethodSelectorProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export function PaymentMethodSelector({
  value,
  onChange,
  disabled = false,
  id = 'payment-method-selector',
  label = 'Método de pago preferido',
  required = false,
  className,
}: PaymentMethodSelectorProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as PaymentMethod)}
        disabled={disabled}
        required={required}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
      >
        <option value="" disabled>
          Seleccionar método de pago
        </option>
        {METHOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default PaymentMethodSelector;
