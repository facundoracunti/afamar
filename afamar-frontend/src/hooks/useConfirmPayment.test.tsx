/**
 * Tests for the `useConfirmPayment` hook.
 *
 * Verifies:
 *  - no-ops when `id` is undefined (new / unsaved document)
 *  - flips `balance_paid` from false → true on first invocation
 *  - sets `balance_paid_at` to today's local ISO on flip
 *  - clears `balance_paid_at` (null) on a second invocation (true → false)
 *  - includes deposit + balance due totals in the payload on the first flip
 *  - invalidates the right TanStack Query key on success
 *  - surfaces API errors to the caller (does not silently swallow)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConfirmPayment } from './useConfirmPayment';
import type { EntityFormState } from '../types';

const queryKey = ['budgets', 'list'] as const;

function makeForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return {
    balance_paid: false,
    balance_paid_at: null,
    total: 1000,
    total_usd: 1,
    ...overrides,
  } as EntityFormState;
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe('useConfirmPayment', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when id is undefined', async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const setForm = vi.fn();
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useConfirmPayment({
          id: undefined,
          balance_paid: false,
          total: 1000,
          total_usd: 1,
          updateFn,
          queryKey: queryKey as unknown as string[],
          setForm: setForm as React.Dispatch<React.SetStateAction<EntityFormState>>,
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => { await result.current(); });
    expect(updateFn).not.toHaveBeenCalled();
    expect(setForm).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('flips balance_paid false → true and stamps today on the payload', async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const setForm = vi.fn();
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const form = makeForm({ balance_paid: false });
    const { result } = renderHook(
      () =>
        useConfirmPayment({
          id: 'b-1',
          balance_paid: form.balance_paid,
          total: form.total,
          total_usd: form.total_usd,
          updateFn,
          queryKey: queryKey as unknown as string[],
          setForm: setForm as React.Dispatch<React.SetStateAction<EntityFormState>>,
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => { await result.current(); });

    expect(updateFn).toHaveBeenCalledTimes(1);
    const [sentId, sentPayload] = updateFn.mock.calls[0];
    expect(sentId).toBe('b-1');
    expect(sentPayload.balance_paid).toBe(true);
    expect(typeof sentPayload.balance_paid_at).toBe('string');
    expect(sentPayload.balance_paid_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sentPayload.deposit_received).toBe(1000);
    expect(sentPayload.deposit_currency).toBe('ARS');
    expect(sentPayload.balance_due).toBe(0);
    expect(sentPayload.deposit_usd).toBe(1);
    expect(sentPayload.balance_due_usd).toBe(0);

    expect(setForm).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
  });

  it('flips balance_paid true → false and clears balance_paid_at', async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const setForm = vi.fn();
    const queryClient = makeQueryClient();

    const { result } = renderHook(
      () =>
        useConfirmPayment({
          id: 'b-2',
          balance_paid: true,
          total: 5000,
          total_usd: 5,
          updateFn,
          queryKey: queryKey as unknown as string[],
          setForm: setForm as React.Dispatch<React.SetStateAction<EntityFormState>>,
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => { await result.current(); });

    const [, sentPayload] = updateFn.mock.calls[0];
    expect(sentPayload.balance_paid).toBe(false);
    expect(sentPayload.balance_paid_at).toBeNull();
    // No deposit / balance update on the unpay path
    expect(sentPayload.deposit_received).toBeUndefined();
    expect(sentPayload.balance_due).toBeUndefined();
  });

  it('does NOT swallow API errors', async () => {
    const updateFn = vi.fn().mockRejectedValue(new Error('Network down'));
    const setForm = vi.fn();
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useConfirmPayment({
          id: 'b-3',
          balance_paid: false,
          total: 100,
          total_usd: 0.1,
          updateFn,
          queryKey: queryKey as unknown as string[],
          setForm: setForm as React.Dispatch<React.SetStateAction<EntityFormState>>,
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await expect(act(async () => { await result.current(); })).rejects.toThrow('Network down');
    // setForm / invalidateQueries must NOT run on a failed update.
    expect(setForm).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('uses different query keys for budgets vs work orders', async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const setForm = vi.fn();
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useConfirmPayment({
          id: 'wo-1',
          balance_paid: false,
          total: 100,
          total_usd: 0.1,
          updateFn,
          queryKey: ['work-orders', 'list'],
          setForm: setForm as React.Dispatch<React.SetStateAction<EntityFormState>>,
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => { await result.current(); });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-orders', 'list'] });
  });
});
