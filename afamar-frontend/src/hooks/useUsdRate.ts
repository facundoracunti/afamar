/**
 * `useUsdRate` — fetches the "dólar del día" (USD venta rate) from the
 * external API and applies it to the form state. Also returns a manual
 * `refresh()` so the operator can re-fetch without reloading the page.
 *
 * The fetched timestamp is stored on the form (`usd_rate_fetched_at`)
 * so the PDF can print "Dólar del día (DD/MM HH:mm)" as a paper trail.
 */
import { useCallback, useEffect, useState } from 'react';
import type { EntityFormState } from '../types';
import { fetchUsdVenta } from '../utils/dolarApi';

interface UseUsdRateParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  /** Skip the initial fetch (e.g. for the edit-form where the rate is
   *  loaded from the saved entity, not from the API). */
  isEdit?: boolean;
}

export interface UseUsdRateReturn {
  fetchedAt: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useUsdRate({ form, setForm, isEdit = false }: UseUsdRateParams): UseUsdRateReturn {
  const [fetchedAt, setFetchedAt] = useState<string | null>(form.usd_rate_fetched_at ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const venta = await fetchUsdVenta();
      const now = new Date().toISOString();
      setFetchedAt(now);
      setForm((prev) => ({ ...prev, usd_rate: venta, usd_rate_fetched_at: now }));
    } catch (err: unknown) {
      // Default 1000 keeps totals computable; surface the error in dev
      // and let the operator retry via the refresh button.
      setError(err instanceof Error ? err.message : 'fetch failed');
      setForm((prev) => ({ ...prev, usd_rate: prev.usd_rate || 1000 }));
    } finally {
      setLoading(false);
    }
  }, [setForm]);

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const venta = await fetchUsdVenta();
        if (cancelled) return;
        const now = new Date().toISOString();
        setFetchedAt(now);
        setForm((prev) => ({ ...prev, usd_rate: venta, usd_rate_fetched_at: now }));
      } catch (err) {
        console.warn('USD venta fetch failed (keeping default 1000):', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, setForm]);

  return { fetchedAt, loading, error, refresh };
}