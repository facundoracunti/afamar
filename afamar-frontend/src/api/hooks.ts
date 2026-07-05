import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { useState } from 'react';

export function useList<T>(key: QueryKey, fetcher: () => Promise<T[]>) {
  const result = useQuery({ queryKey: key, queryFn: fetcher });
  return {
    items: result.data ?? ([] as T[]),
    loading: result.isLoading,
    error: result.error ? (result.error instanceof Error ? result.error.message : "Error al cargar datos") : null,
    load: () => result.refetch(),
  };
}

export interface PaginatedListOptions {
  pageSize?: number;
  initialPage?: number;
}

export interface PaginationInfo {
  total: number;
  skip: number;
  limit: number;
}

type AxiosResponseWithPagination<T> = AxiosResponse<T> & { pagination?: PaginationInfo };

/**
 * Paginated list hook. The fetcher receives { skip, limit } and must return
 * the raw AxiosResponse; the http interceptor attaches `pagination` as a
 * sibling property so the hook can read the total count.
 */
export function usePaginatedList<T>(
  key: QueryKey,
  fetcher: (params: { skip: number; limit: number }) => Promise<AxiosResponse<T[]>>,
  options?: PaginatedListOptions,
) {
  const pageSize = options?.pageSize ?? 25;
  const [page, setPage] = useState(options?.initialPage ?? 1);
  const skip = (page - 1) * pageSize;

  const queryKey = [...key, page, pageSize];
  const result = useQuery({
    queryKey,
    queryFn: async () => fetcher({ skip, limit: pageSize }),
    keepPreviousData: true,
  });

  const res = result.data as AxiosResponseWithPagination<T[]> | undefined;
  return {
    items: res?.data ?? ([] as T[]),
    total: res?.pagination?.total ?? 0,
    page,
    pageSize,
    setPage,
    loading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error ? (result.error instanceof Error ? result.error.message : "Error al cargar datos") : null,
    refetch: () => result.refetch(),
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