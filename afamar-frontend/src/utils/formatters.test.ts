import { describe, expect, it } from 'vitest';
import { parseNumber } from './formatters';

describe('parseNumber — medidas decimales locales', () => {
  it.each([
    ['0.50', 0.5],
    ['0,50', 0.5],
    ['0.15', 0.15],
    ['0,15', 0.15],
    ['1.25', 1.25],
    ['1,25', 1.25],
    ['2.50', 2.5],
    ['2,50', 2.5],
  ])('parses %s as %s', (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });

  it('rejects ambiguous mixed separators instead of changing the value', () => {
    expect(parseNumber('1,234.56')).toBeNull();
    expect(parseNumber('1.234,56')).toBeNull();
  });
});
