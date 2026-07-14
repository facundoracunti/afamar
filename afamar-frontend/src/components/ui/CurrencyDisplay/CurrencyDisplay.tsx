import type { CSSProperties } from 'react';

export interface CurrencyDisplayProps {
  value: number;
  currency?: 'ARS' | 'USD';
  locale?: string;
  decimals?: number;
  className?: string;
  style?: CSSProperties;
}

export function CurrencyDisplay({
  value,
  currency = 'ARS',
  locale = 'es-AR',
  decimals = 2,
  className,
  style,
}: CurrencyDisplayProps) {
  const symbol = currency === 'USD' ? 'US$' : '$';
  const num = Number(value) || 0;
  const formatted = num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span
      className={`currency currency--${currency.toLowerCase()}${className ? ' ' + className : ''}`}
      style={style}
    >
      {symbol} {formatted}
    </span>
  );
}

export default CurrencyDisplay;