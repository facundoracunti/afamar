import type { CSSProperties } from 'react';

export interface CurrencyDisplayProps {
  value: number;
  currency?: 'ARS' | 'USD';
  className?: string;
  style?: CSSProperties;
}

export function CurrencyDisplay({ value, currency = 'ARS', className, style }: CurrencyDisplayProps) {
  const symbol = currency === 'USD' ? 'US$' : '$';
  return <span className={`currency currency--${currency.toLowerCase()}${className ? ' ' + className : ''}`} style={style}>{symbol} {value.toFixed(2)}</span>;
}

export default CurrencyDisplay;
