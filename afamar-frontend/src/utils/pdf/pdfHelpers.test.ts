import { describe, expect, it } from 'vitest';
import { formatDate } from './pdfHelpers';

describe('formatDate', () => {
  it('renders date-only strings in local time without the UTC day-shift', () => {
    // Regression: new Date('2026-09-01') is UTC midnight → in UTC-3 the
    // local date is 2026-08-31, so the old code printed "31/8/2026" for
    // today. Parsing components locally must keep the calendar day.
    expect(formatDate('2026-09-01')).toBe('1/9/2026');
    expect(formatDate('2026-09-16')).toBe('16/9/2026');
    expect(formatDate('2024-02-29')).toBe('29/2/2024');
  });

  it('handles full ISO timestamps by slicing to the date part first', () => {
    expect(formatDate('2026-09-01T12:34:56')).toBe('1/9/2026');
  });

  it('falls back to today when empty and to the raw string when unparseable', () => {
    const today = new Date().toLocaleDateString('es-AR');
    expect(formatDate('')).toBe(today);
    expect(formatDate(null)).toBe(today);
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});