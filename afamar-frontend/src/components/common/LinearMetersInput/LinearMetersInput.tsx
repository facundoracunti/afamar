import React, { useEffect, useState } from 'react';
import { parseNumber } from '../../../utils/formatters';

function formatInitialDraft(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value === 0) return '';
  return trimTrailingZeros(String(value));
}

function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

interface LinearMetersInputProps {
  value: number | null | undefined;
  onCommit: (value: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  title?: string;
  'data-testid'?: string;
}

export function LinearMetersInput({
  value,
  onCommit,
  disabled,
  className,
  placeholder,
  title,
  ...rest
}: LinearMetersInputProps) {
  const [draft, setDraft] = useState<string>(() => formatInitialDraft(value));

  useEffect(() => {
    setDraft(formatInitialDraft(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    if (raw.trim() === '' || raw === '.' || raw === ',' || raw === '-') {
      onCommit(0);
      return;
    }
    const parsed = parseNumber(raw);
    if (parsed !== null && parsed >= 0) {
      onCommit(parsed);
    }
  };

  const handleBlur = () => {
    const cleaned = draft.trim();
    if (cleaned === '' || cleaned === '.' || cleaned === ',' || cleaned === '-') {
      setDraft('');
      return;
    }
    const parsed = parseNumber(cleaned);
    if (parsed !== null && parsed >= 0) {
      setDraft(parsed === 0 ? '' : trimTrailingZeros(String(parsed)));
    } else {
      setDraft('');
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder ?? '0.00'}
      title={title}
      autoComplete="off"
      spellCheck={false}
      {...rest}
    />
  );
}
