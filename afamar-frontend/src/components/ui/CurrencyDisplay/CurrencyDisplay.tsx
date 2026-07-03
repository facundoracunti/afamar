import type { CSSProperties } from 'react';

export interface CurrencyDisplayProps {
  value: number;
  currency?: 'ARS' | 'USD';
  className?: string;
  style?: CSSProperties;
}

export function CurrencyDisplay({ value, currency = 'ARS', className, style }: CurrencyDisplayProps) {
  const symbol = currency === 'USD' ? 'US$' : '$';
  const num = Number(value) || 0;
  return <span className={`currency currency--${currency.toLowerCase()}${className ? ' ' + className : ''}`} style={style}>{symbol} {num.toFixed(2)}</span>;
}

export default CurrencyDisplay;
