import React from 'react';

interface CurrencyDisplayProps {
  value: number;
  currency?: 'ARS' | 'USD';
  style?: React.CSSProperties;
}

export default function CurrencyDisplay({ value, currency = 'ARS', style }: CurrencyDisplayProps) {
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return (
    <span style={{ fontWeight: 700, color: currency === 'USD' ? '#059669' : '#dc2626', ...style }}>
      {formatted}
    </span>
  );
}
