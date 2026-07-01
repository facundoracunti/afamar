import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';

export function useList<T>(key: QueryKey, fetcher: () => Promise<T[]>) {
  const result = useQuery({ queryKey: key, queryFn: fetcher });
  return {
    items: result.data ?? ([] as T[]),
    loading: result.isLoading,
    error: result.error ? (result.error instanceof Error ? result.error.message : "Error al cargar datos") : null,
    load: () => result.refetch(),
  };
}

export function useGet<T>(key: QueryKey, fetcher: () => Promise<T>, enabled = true) {
  const result = useQuery({ queryKey: key, queryFn: fetcher, enabled });
  return {
    data: result.data,
    loading: result.isLoading,
    error: result.error ? (result.error instanceof Error ? result.error.message : "Error al cargar datos") : null,
    load: () => result.refetch(),
  };
}

export function useCreate<TData, TVariables>(
  _key: QueryKey,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: { onSuccess?: () => void; invalidateKeys?: QueryKey[] }
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      }
      options?.onSuccess?.();
    },
  });
}

export function useUpdate<TData, TVariables>(
  _key: QueryKey,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: { onSuccess?: () => void; invalidateKeys?: QueryKey[] }
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      }
      options?.onSuccess?.();
    },
  });
}

export function useDelete<TData, TVariables>(
  _key: QueryKey,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: { onSuccess?: () => void; invalidateKeys?: QueryKey[] }
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      }
      options?.onSuccess?.();
    },
  });
}
