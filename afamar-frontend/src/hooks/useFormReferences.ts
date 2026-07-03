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
  materiales: Material[];
  piletas: Pool[];
  clientes: Client[];
  logoUrl: string;
  refreshClientes: () => void;
}

/**
 * Composable: loads the reference data (materials, pools, clients) plus
 * the company logo from /api/v1/settings, fetches the next entity number
 * for new entities, and pre-fills the form when editing.
 *
 * Replaces the "useEffect for references / logo / nextNumber / initial load"
 * block from legacy `useEntityForm`.
 */
export function useFormReferences({
  services,
  defaultEstado,
  id,
  isEdit,
  setForm,
  setLoading,
  onLoaded,
}: UseFormReferencesParams): UseFormReferencesReturn {
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [piletas, setPiletas] = useState<Pool[]>([]);
  const [clientes, setClientes] = useState<Client[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');

  const fetchClientes = () => {
    services.getClients({ limit: 500 }).then((res) => {
      setClientes((res.data as unknown as Client[]) || []);
    });
  };

  useEffect(() => {
    services.getMaterials({ limit: 500 }).then((res) => {
      setMateriales((res.data as unknown as Material[]) || []);
    });
    services.getPools().then((res) => {
      setPiletas((res.data as unknown as Pool[]) || []);
    });
    fetchClientes();
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

    if (!isEdit && services.getNextNumero) {
      services
        .getNextNumero()
        .then((res) => {
          setForm((prev) => ({
            ...prev,
            number: (res.data as Record<string, unknown>).number as string,
          }));
        })
        .catch(() => {});
    }
    if (id) {
      services.getById(id).then((res) => {
        const d = res.data as Record<string, unknown>;
        setForm(mapApiToForm(d, defaultEstado));
        onLoaded?.(d);
        setLoading(false);
      });
    }
    // We intentionally do not depend on `defaultEstado` — it's captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  return { materiales, piletas, clientes, logoUrl, refreshClientes: fetchClientes };
}