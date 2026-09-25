/**
 * `useUsdRate` — fetches the "dólar del día" from the centralized backend quote
 * service (`GET /dolar/rates`, proxying dolarapi.com) and applies it to the
 * form state. Also returns a manual `refresh()` so the operator can re-fetch
 * without reloading the page.
 *
 * The rate selected depends on the document type (`source`):
 *   - `'official'` (presupuestos) → Dólar Oficial Venta.
 *   - `'blue_mid'` (órdenes de trabajo / cobros) → Dólar Blue promedio.
 *
 * The fetched timestamp is stored on the form (`usd_rate_fetched_at`)
 * so the PDF can print "Dólar del día (DD/MM HH:mm)" as a paper trail.
 */
import { useCallback, useEffect, useState } from 'react';
import type { EntityFormState } from '../types';
import { fetchDolarRates, rateForSource, type UsdRateSource } from '../utils/dolarApi';

interface UseUsdRateParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  /** Skip the initial fetch (e.g. for the edit-form where the rate is
   *  loaded from the saved entity, not from the API). */
  isEdit?: boolean;
  /** Which cotización to apply: `'official'` (presupuestos) o `'blue_mid'`
   *  (órdenes de trabajo / cobros). Defaults to `'official'`. */
  source?: UsdRateSource;
}

export interface UseUsdRateReturn {
  fetchedAt: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useUsdRate({
  form,
  setForm,
  source = 'official',
}: UseUsdRateParams): UseUsdRateReturn {
  const [fetchedAt, setFetchedAt] = useState<string | null>(form.usd_rate_fetched_at ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rates = await fetchDolarRates();
      const value = rateForSource(rates, source);
      const now = new Date().toISOString();
      setFetchedAt(now);
      setForm((prev) => ({ ...prev, usd_rate: value, usd_rate_fetched_at: now }));
    } catch (err: unknown) {
      // Si falla el fetch, mantenemos el rate actual (1500 por default) para
      // que los totales sigan siendo computables. El operador puede reintentar
      // con el botón de refresh.
      setError(err instanceof Error ? err.message : 'fetch failed');
      setForm((prev) => ({ ...prev, usd_rate: prev.usd_rate || 1500 }));
    } finally {
      setLoading(false);
    }
  }, [setForm, source]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rates = await fetchDolarRates();
        if (cancelled) return;
        const value = rateForSource(rates, source);
        const now = new Date().toISOString();
        setFetchedAt(now);
        // Solo pisar `usd_rate` cuando:
        //   - el form aún no tiene uno (caso "nuevo" — usa el default 1500)
        //   - O cuando estamos editando: actualizar siempre al valor del día
        //     (el operador puede revertir con el refresh manual).
        setForm((prev) => ({
          ...prev,
          usd_rate: value,
          usd_rate_fetched_at: now,
        }));
      } catch (err) {
        console.warn(`USD ${source} fetch failed (keeping current rate):`, err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setForm, source]);

  return { fetchedAt, loading, error, refresh };
}