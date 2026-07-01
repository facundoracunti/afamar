// @ts-nocheck
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/api/client";
import type { ReferenceItem } from "@/types";

interface ReferencesData {
  budgetStatuses: ReferenceItem[];
  workOrderStatuses: ReferenceItem[];
  paymentMethods: ReferenceItem[];
  priorityLevels: ReferenceItem[];
  finishTypes: ReferenceItem[];
}

interface ReferencesContextType extends ReferencesData {
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const ReferencesContext = createContext<ReferencesContextType | null>(null);

const INITIAL: ReferencesData = {
  budgetStatuses: [],
  workOrderStatuses: [],
  paymentMethods: [],
  priorityLevels: [],
  finishTypes: [],
};

export function ReferencesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ReferencesData>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bs, wos, pm, pl, ft] = await Promise.all([
        api.references.budgetStatuses.list(),
        api.references.workOrderStatuses.list(),
        api.references.paymentMethods.list(),
        api.references.priorityLevels.list(),
        api.references.finishTypes.list(),
      ]);
      setData({
        budgetStatuses: bs || [],
        workOrderStatuses: wos || [],
        paymentMethods: pm || [],
        priorityLevels: pl || [],
        finishTypes: ft || [],
      });
    } catch {
      setError("Error al cargar datos de referencia");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <ReferencesContext.Provider value={{ ...data, loading, error, refetch: fetchAll }}>
      {children}
    </ReferencesContext.Provider>
  );
}

export function useReferences(): ReferencesContextType {
  const ctx = useContext(ReferencesContext);
  if (!ctx) throw new Error("useReferences must be used within ReferencesProvider");
  return ctx;
}
