import { useState, useEffect } from 'react';
import api from '../api/http';
import type { Client } from '../types/client';
import type { Material } from '../types/material';
import type { Pool } from '../types/poolStock';
import type { EntityFormState, EntityServices } from '../types';
import { mapApiToForm } from './entityFormHelpers';

interface UseFormReferencesParams {
  services: EntityServices;
  defaultEstado: string;
  id: string | undefined;
  isEdit: boolean;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  onLoaded?: (data: Record<string, unknown>) => void;
}

interface UseFormReferencesReturn {
  materials: Material[];
  pools: Pool[];
  clientes: Client[];
  logoUrl: string;
  /**
   * Either refresh the client list from the API (no args), or prepend a
   * freshly-created client to the local cache (pass the new Client).
   * The prepend path lets `ClientSection` keep the form values intact while
   * still making the new entry available in the typeahead.
   */
  addOrRefreshClientes: (newClient?: Client) => void;
}

export function useFormReferences({
  services,
  defaultEstado,
  id,
  isEdit,
  setForm,
  setLoading,
  onLoaded,
}: UseFormReferencesParams): UseFormReferencesReturn {
  const [materials, setMateriales] = useState<Material[]>([]);
  const [pools, setPiletas] = useState<Pool[]>([]);
  const [clientes, setClientes] = useState<Client[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');

  const fetchClientes = () => {
    services.getClients({ limit: 500 }).then((res) => {
      setClientes((res.data as unknown as Client[]) || []);
    });
  };

  /**
   * Prepend a freshly-created client to the local cache (no API refetch).
   * Falls back to a full refresh when called without arguments so existing
   * callers keep working.
   */
  const addOrRefreshClientes = (newClient?: Client) => {
    if (!newClient) {
      fetchClientes();
      return;
    }
    setClientes((prev) => {
      // Avoid duplicates if a refresh raced in between create and callback.
      if (prev.some((c) => c.id === newClient.id)) return prev;
      return [newClient, ...prev];
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function loadEverything() {
      try {
        // Load reference data (clients, materials, pools, logo, next number).
        const clientsRes = await services.getClients({ limit: 500 });
        if (cancelled) return;
        const loadedClientes = (clientsRes.data as unknown as Client[]) || [];
        setClientes(loadedClientes);

        // Materials + pools in parallel (independent of clients).
        const [materialsRes, poolsRes] = await Promise.all([
          services.getMaterials({ limit: 500 }),
          services.getPools(),
        ]);
        if (cancelled) return;
        setMateriales((materialsRes.data as unknown as Material[]) || []);
        setPiletas((poolsRes.data as unknown as Pool[]) || []);

        // Settings (logo) — fire and forget; the logo is optional.
        api
          .get('/settings')
          .then((res) => {
            const configs = (res as unknown as Record<string, unknown>).data as Record<string, unknown>;
            const logoValue = configs?.['company_logo'] || configs?.['logo'];
            if (logoValue && typeof logoValue === 'string') {
              const base = (api.defaults.baseURL || '').replace(/\/api\/v\d+$/, '').replace(/\/api$/, '');
              setLogoUrl(`${base}${logoValue.startsWith('/') ? '' : '/'}${logoValue}`);
            }
          })
          .catch(() => {
            /* logo is optional */
          });

        // Next number for new entities.
        if (!isEdit && services.getNextNumero) {
          try {
            const res = await services.getNextNumero();
            if (cancelled) return;
            setForm((prev) => ({
              ...prev,
              number: (res.data as Record<string, unknown>).number as string,
            }));
          } catch {
            /* not critical */
          }
        }

        // Load the entity last so `clientes` is already populated for the
        // resolver fallback.
        if (id) {
          const res = await services.getById(id);
          if (cancelled) return;
          const d = res.data as Record<string, unknown>;
          setForm(mapApiToForm(d, defaultEstado));
          onLoaded?.(d);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) console.error('useFormReferences load error:', err);
      }
    }

    loadEverything();

    return () => {
      cancelled = true;
    };
    // We intentionally do not depend on `defaultEstado` — it's captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  return { materials, pools, clientes, logoUrl, addOrRefreshClientes };
}