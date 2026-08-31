/**
 * Loads reference data (clients, materials, pools, settings/logo,
 * payment methods) for the Budget/WorkOrder form pages via TanStack
 * Query.
 *
 * Reference data is shared across all form pages, so we use stable,
 * file-level query keys (`CLIENTS_KEY`, `MATERIALS_KEY`, `POOLS_KEY`,
 * `SETTINGS_KEY`, `PAYMENT_METHODS_KEY`). Reference data has a
 * 5-minute `staleTime` so opening a second form (e.g. switching from
 * Budgets to WorkOrders) does not refetch the catalogue. The entity
 * being edited (Budget or WorkOrder) is fetched fresh every time the
 * id changes (no staleTime) so the form always reflects the latest
 * snapshot.
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/http';
import type { Client } from '../types/client';
import type { Material } from '../types/material';
import type { Pool } from '../types/poolStock';
import type { PaymentMethod } from '../types/paymentMethod';
import type { EntityFormState, EntityServices } from '../types';
import { getActivePaymentMethods } from '../api/resources/paymentMethods';
import { mapApiToForm } from './entityFormHelpers';

interface UseFormReferencesParams {
  services: EntityServices;
  defaultStatus: string;
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
  paymentMethods: PaymentMethod[];
  logoUrl: string;
  /**
   * Either refresh the client list from the API (no args), or prepend a
   * freshly-created client to the local cache (pass the new Client).
   * The prepend path lets `ClientSection` keep the form values intact while
   * still making the new entry available in the typeahead.
   */
  addOrRefreshClientes: (newClient?: Client) => void;
  updateClientAddresses: (clientId: number, addresses: Client['addresses']) => void;
}

const REFERENCE_STALE_TIME = 5 * 60 * 1000;

export const CLIENTS_KEY = ['clients', 'reference'] as const;
export const MATERIALS_KEY = ['materials', 'reference'] as const;
export const POOLS_KEY = ['pools', 'reference'] as const;
export const SETTINGS_KEY = ['settings', 'reference'] as const;
export const PAYMENT_METHODS_KEY = ['payment-methods', 'reference'] as const;
const ENTITY_KEY = (entity: string, id: string | undefined) => [entity, id] as const;
const NEXT_NUMBER_KEY = (entity: string) => [entity, 'next-number'] as const;

export function useFormReferences({
  services,
  defaultStatus,
  id,
  isEdit,
  setForm,
  setLoading,
  onLoaded,
}: UseFormReferencesParams): UseFormReferencesReturn {
  const queryClient = useQueryClient();

  // --- Reference data (clients, materials, pools, settings) — 5 min cache.
  const clientsQuery = useQuery<Client[]>({
    queryKey: [...CLIENTS_KEY],
    queryFn: async () => {
      const res = await services.getClients({ limit: 500 });
      return (res.data as unknown as Client[]) || [];
    },
    staleTime: REFERENCE_STALE_TIME,
  });
  const materialsQuery = useQuery<Material[]>({
    queryKey: [...MATERIALS_KEY],
    queryFn: async () => {
      const res = await services.getMaterials({ limit: 500 });
      return (res.data as unknown as Material[]) || [];
    },
    staleTime: REFERENCE_STALE_TIME,
  });
  const poolsQuery = useQuery<Pool[]>({
    queryKey: [...POOLS_KEY],
    queryFn: async () => {
      const res = await services.getPools();
      return (res.data as unknown as Pool[]) || [];
    },
    staleTime: REFERENCE_STALE_TIME,
    // Always refetch when the window regains focus so a pool added in the
    // Stock de Piletas page shows up automatically in the form's "AGREGAR
    // PILETA" select without waiting for the 5-min cache to expire.
    refetchOnWindowFocus: () => true,
  });
  const paymentMethodsQuery = useQuery<PaymentMethod[]>({
    queryKey: [...PAYMENT_METHODS_KEY],
    queryFn: async () => getActivePaymentMethods(),
    staleTime: REFERENCE_STALE_TIME,
  });
  const settingsQuery = useQuery<Record<string, unknown>>({
    queryKey: [...SETTINGS_KEY],
    queryFn: async () => {
      const res = await api.get('/settings');
      return (res as unknown as Record<string, unknown>).data as Record<string, unknown>;
    },
    staleTime: REFERENCE_STALE_TIME,
  });

  const clientes = clientsQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const pools = poolsQuery.data ?? [];
  const paymentMethods = paymentMethodsQuery.data ?? [];

  const logoUrl = useMemo(() => {
    const configs = settingsQuery.data;
    if (!configs) return '';
    const logoValue = configs['company_logo'] || configs['logo'];
    if (!logoValue || typeof logoValue !== 'string') return '';
    const base = (api.defaults.baseURL || '').replace(/\/api\/v\d+$/, '').replace(/\/api$/, '');
    return `${base}${logoValue.startsWith('/') ? '' : '/'}${logoValue}`;
  }, [settingsQuery.data]);

  // --- Next number for new entities.
  const nextNumberQuery = useQuery<{ number: string }>({
    queryKey: [...NEXT_NUMBER_KEY(services.listPath)],
    queryFn: async () => {
      if (!services.getNextNumero) return { number: '' };
      const res = await services.getNextNumero();
      return (res.data as unknown as { number: string });
    },
    enabled: !isEdit && !!services.getNextNumero,
    staleTime: 0, // always refetch when opening a new form
  });
  useEffect(() => {
    if (!nextNumberQuery.data || !nextNumberQuery.data.number) return;
    setForm((prev) => ({ ...prev, number: nextNumberQuery.data!.number }));
  }, [nextNumberQuery.data, setForm]);

  // --- Entity being edited (Budget / WorkOrder) — fresh on every id change.
  const entityQuery = useQuery<Record<string, unknown>>({
    queryKey: [...ENTITY_KEY(services.listPath, id)],
    queryFn: async () => {
      const res = await services.getById(id as string);
      return res.data as Record<string, unknown>;
    },
    enabled: !!id,
    staleTime: 0,
  });

  // Bridge the entity query result into the form state and the loading flag.
  useEffect(() => {
    if (id && entityQuery.data) {
      const d = entityQuery.data;
      setForm(mapApiToForm(d, defaultStatus));
      onLoaded?.(d);
      setLoading(false);
    } else if (!id) {
      // New form: there's no entity to load — clear the loading state
      // immediately so the form renders.
      setLoading(false);
    }
    // Errors during entity fetch are intentionally silent: the caller
    // owns the notification (via the form's onError callback), and we
    // don't want to drop the loading state on transient errors that
    // TanStack Query will retry automatically.
    // We intentionally do not depend on `defaultStatus` — it's captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityQuery.data, id]);

  const addOrRefreshClientes = (newClient?: Client) => {
    if (!newClient) {
      void queryClient.invalidateQueries({ queryKey: [...CLIENTS_KEY] });
      return;
    }
    queryClient.setQueryData<Client[]>([...CLIENTS_KEY], (prev) => {
      const list = prev ?? [];
      if (list.some((c) => c.id === newClient.id)) return list;
      return [newClient, ...list];
    });
  };

  const updateClientAddresses = (clientId: number, addresses: Client['addresses']) => {
    queryClient.setQueryData<Client[]>([...CLIENTS_KEY], (prev) => {
      const list = prev ?? [];
      return list.map((c) => (c.id === clientId ? { ...c, addresses } : c));
    });
  };

  return {
    materials,
    pools,
    clientes,
    paymentMethods,
    logoUrl,
    addOrRefreshClientes,
    updateClientAddresses,
  };
}
