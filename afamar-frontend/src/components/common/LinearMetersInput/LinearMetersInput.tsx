import React, { useEffect, useState } from 'react';

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
    const cleaned = raw.replace(',', '.');
    if (cleaned === '' || cleaned === '.' || cleaned === '-') {
      onCommit(0);
      return;
    }
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onCommit(parsed);
    }
  };

  const handleBlur = () => {
    const cleaned = draft.replace(',', '.').trim();
    if (cleaned === '' || cleaned === '.' || cleaned === '-') {
      setDraft('');
      return;
    }
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed >= 0) {
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
