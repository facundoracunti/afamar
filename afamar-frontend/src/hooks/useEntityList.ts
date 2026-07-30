/**
 * `useEntityList` — the boilerplate shared by every list page (clients,
 * materials, pool stock, work orders, budgets):
 *   - search input state (drives the query key)
 *   - delete-confirmation state
 *   - paginated query
 *   - delete mutation
 *   - `notify(success)` / `notify(error)` flow
 *
 * Page-level extras (extra filters like status / category, action buttons
 * per row, lightbox modals, etc.) stay in the consuming page. The hook
 * only owns the cross-cutting delete + search + pagination.
 */
import { useCallback, useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useDelete, usePaginatedList } from '../api/hooks';
import { parseApiError } from '../utils/error';
import { useNotify } from '../context/NotificationContext';
import type { AxiosResponse } from 'axios';

interface UseEntityListOptions<T, IdT> {
  /** TanStack query key prefix. The hook appends `[search, page, pageSize]`
   *  so a new search automatically triggers a refetch via key change. */
  queryKey: QueryKey;
  /** Fetcher that returns the raw `AxiosResponse<T[]>` (the same shape the
   *  shared `usePaginatedList` hook expects). */
  listFetcher: (params: { skip: number; limit: number }) => Promise<AxiosResponse<T[]>>;
  /** Mutation that performs the actual delete. */
  deleteFn: (id: IdT) => Promise<unknown>;
  pageSize?: number;
  /** Toast text on a successful delete. */
  successMessage?: string;
  /** Fallback toast text on a failed delete. */
  errorMessage?: string;
  /** Extra keys to invalidate alongside the main one when a delete succeeds. */
  invalidateKeys?: QueryKey[];
}

export interface UseEntityListReturn<T, IdT> {
  // Server state
  items: T[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  refetch: () => unknown;

  // Search
  search: string;
  setSearch: (s: string) => void;

  // Delete flow
  deleteId: IdT | null;
  requestDelete: (id: IdT) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

export function useEntityList<T, IdT>({
  queryKey,
  listFetcher,
  deleteFn,
  pageSize = 10,
  successMessage = 'Eliminado correctamente',
  errorMessage = 'Error al eliminar',
  invalidateKeys,
}: UseEntityListOptions<T, IdT>): UseEntityListReturn<T, IdT> {
  // Internal state — renamed with the `_` prefix so the destructured
  // `search`/`setSearch` exposed below don't collide with this local
  // variable inside the closure that defines `listFetcher`.
  const [searchValue, setSearchValue] = useState<string>('');
  const [deleteId, setDeleteId] = useState<IdT | null>(null);
  const notify = useNotify();

  const queryKeyWithSearch: QueryKey = [...queryKey, searchValue];

  const { items, loading, total, page, pageSize: actualPageSize, setPage, refetch } =
    usePaginatedList<T>(queryKeyWithSearch, listFetcher, { pageSize });

  const deleteMutation = useDelete<unknown, IdT>(
    queryKey,
    async (id) => {
      await deleteFn(id);
    },
    // Default: invalidate the main query so the row disappears. Callers
    // can pass additional keys (e.g. cross-list caches like
    // /work-orders after converting a budget).
    { invalidateKeys: invalidateKeys ?? [queryKey] },
  );

  const requestDelete = useCallback((id: IdT) => setDeleteId(id), []);
  const cancelDelete = useCallback(() => setDeleteId(null), []);

  const confirmDelete = useCallback(async () => {
    if (deleteId === null) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
      notify(successMessage, 'success');
    } catch (err: unknown) {
      notify(parseApiError(err, errorMessage), 'error');
    }
  }, [deleteId, deleteMutation, notify, successMessage, errorMessage]);

  return {
    items,
    loading,
    total,
    page,
    pageSize: actualPageSize,
    setPage,
    refetch,
    search: searchValue,
    setSearch: setSearchValue,
    deleteId,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}