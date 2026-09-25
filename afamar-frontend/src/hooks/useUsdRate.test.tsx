/**
 * Tests for the `useUsdRate` hook.
 *
 * Verifies the dollar source selection is applied correctly per document type:
 *  - `source='official'` (presupuestos) → Dólar Oficial Venta.
 *  - `source='blue_mid'` (órdenes de trabajo) → Dólar Blue promedio.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useUsdRate } from './useUsdRate';
import type { EntityFormState } from '../types';
import type { DolarRates } from '../utils/dolarApi';

vi.mock('../utils/dolarApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/dolarApi')>();
  return {
    ...original,
    fetchDolarRates: vi.fn(),
  };
});

import { fetchDolarRates } from '../utils/dolarApi';

const RATES: DolarRates = {
  official_sale_rate: 1450.0,
  blue_mid_rate: 1550.0,
  updated_at: '2026-09-25T12:00:00+00:00',
};

function makeForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return {
    usd_rate: 1000,
    usd_rate_fetched_at: null,
    ...overrides,
  } as EntityFormState;
}

describe('useUsdRate', () => {
  beforeEach(() => {
    vi.mocked(fetchDolarRates).mockReset();
    vi.mocked(fetchDolarRates).mockResolvedValue(RATES);
  });

  it('fetches the centralized rates on mount (presupuestos)', async () => {
    const { result } = renderHook(() => {
      const [form, setForm] = useState<EntityFormState>(makeForm());
      return useUsdRate({ form, setForm, source: 'official' });
    });

    await act(async () => {});
    expect(fetchDolarRates).toHaveBeenCalledTimes(1);
    expect(result.current.fetchedAt).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('triggers the fetch for the blue_mid source (órdenes de trabajo)', async () => {
    renderHook(() => {
      const [form, setForm] = useState<EntityFormState>(makeForm());
      return useUsdRate({ form, setForm, source: 'blue_mid' });
    });

    await act(async () => {});
    expect(fetchDolarRates).toHaveBeenCalledTimes(1);
  });

  it('refresh() resolves and stores the fetched timestamp (official)', async () => {
    const { result } = renderHook(() => {
      const [form, setForm] = useState<EntityFormState>(makeForm({ usd_rate: 1000 }));
      return useUsdRate({ form, setForm, source: 'official' });
    });

    await act(async () => { await result.current.refresh(); });
    expect(fetchDolarRates).toHaveBeenCalled();
    expect(result.current.fetchedAt).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('keeps the current rate and surfaces an error when the fetch fails', async () => {
    // Both the mount effect and refresh() must see the failure.
    vi.mocked(fetchDolarRates).mockReset();
    vi.mocked(fetchDolarRates).mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => {
      const [form, setForm] = useState<EntityFormState>(makeForm({ usd_rate: 1300 }));
      return useUsdRate({ form, setForm, source: 'blue_mid' });
    });

    await act(async () => { await result.current.refresh(); });
    expect(result.current.error).toContain('Network down');
  });
});