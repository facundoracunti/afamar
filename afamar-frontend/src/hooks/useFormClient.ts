import { useState, useCallback, useMemo } from 'react';
import type { Client } from '../types/client';
import type { EntityFormState } from '../types';

interface UseFormClientParams {
  clientes: Client[];
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
}

interface UseFormClientReturn {
  showClientDropdown: boolean;
  setShowClientDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  filteredClients: Client[];
  handleClientSelect: (c: Record<string, unknown>) => void;
}

/**
 * Composable: handles the client autocomplete dropdown on the budget /
 * work-order form. Filtering is done in-memory over the loaded clients
 * matching the typed `client_name`.
 */
export function useFormClient({ clientes, form, setForm }: UseFormClientParams): UseFormClientReturn {
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);

  const filteredClients = useMemo(
    () =>
      clientes.filter((c) =>
        (c.name || '').toLowerCase().includes((form.client_name || '').toLowerCase())
      ),
    [clientes, form.client_name]
  );

  const handleClientSelect = useCallback(
    (c: Record<string, unknown>) => {
      setForm((prev) => ({
        ...prev,
        client_name: c.name as string,
        client_phone: (c.phone as string) || '',
        client_email: (c.email as string) || '',
        client_address: (c.address as string) || '',
      }));
      setShowClientDropdown(false);
    },
    [setForm]
  );

  return { showClientDropdown, setShowClientDropdown, filteredClients, handleClientSelect };
}