import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useFormActions } from './useFormActions';
import { INITIAL_FORM } from './entityFormConstants';
import type { EntityFormState, EntityServices } from '../types';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, qc };
}

function makeServices(create: EntityServices['create']) {
  return {
    create,
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    getById: vi.fn().mockResolvedValue({}),
    getNextNumero: vi.fn().mockResolvedValue({}),
    getMaterials: vi.fn().mockResolvedValue([]),
    getPools: vi.fn().mockResolvedValue([]),
    getClients: vi.fn().mockResolvedValue([]),
    listPath: '/admin/work-orders',
  } as unknown as EntityServices;
}

describe('useFormActions double-submit guard', () => {
  it('creates only ONE document when handleSubmit fires twice in flight', async () => {
    let resolveCreate!: (v: unknown) => void;
    const gate = new Promise((res) => (resolveCreate = res));
    const create = vi.fn().mockImplementation(() => gate);
    const services = makeServices(create);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () =>
        useFormActions({
          form: { ...INITIAL_FORM } as EntityFormState,
          setForm: () => {},
          setSaving: () => {},
          services,
          id: undefined,
          isEdit: false,
          navigate: () => {},
          buildPayload: () => ({}),
          onError: () => {},
          onAfterAction: () => {},
        }),
      { wrapper },
    );

    // Fire both submits while the first POST is still in flight (this is
    // what a type="submit" button inside a <form onSubmit> did before the
    // guard: one click produced two POSTs → two identical WOs + 2 señas).
    const p1 = result.current.handleSubmit(undefined as never);
    const p2 = result.current.handleSubmit(undefined as never);
    resolveCreate({ id: 1 });
    const r1 = await p1;
    const r2 = await p2;

    expect(create).toHaveBeenCalledTimes(1);
    expect(r1).toBe(true);
    expect(r2).toBe(false);
  });

  it('blocks a SECOND submit after the first create already completed (post-finally window)', async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: 9 } });
    const services = makeServices(create);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () =>
        useFormActions({
          form: { ...INITIAL_FORM } as EntityFormState,
          setForm: () => {},
          setSaving: () => {},
          services,
          id: undefined,
          isEdit: false,
          navigate: () => {},
          buildPayload: () => ({}),
          onError: () => {},
        }),
      { wrapper },
    );

    // The create resolves IMMEDIATELY. Between `finally` (sets saving=false
    // and releases the in-flight ref) and the actual navigation unmount there
    // is a few-ms window where the button is re-enabled — a click there used
    // to POST a duplicate order. `createdRef` must keep it blocked.
    const r1 = await result.current.handleSubmit(undefined as never);
    const r2 = await result.current.handleSubmit(undefined as never);

    expect(r1).toBe(true);
    expect(r2).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('useFormActions after-action info', () => {
  it('passes { created: true, id } to onAfterAction after a create so the caller can navigate to the edit page', async () => {
    const services = makeServices(vi.fn().mockResolvedValue({ data: { id: 42 } }));
    const onAfterAction = vi.fn();
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () =>
        useFormActions({
          form: { ...INITIAL_FORM } as EntityFormState,
          setForm: () => {},
          setSaving: () => {},
          services,
          id: undefined,
          isEdit: false,
          navigate: () => {},
          buildPayload: () => ({}),
          onError: () => {},
          onAfterAction,
        }),
      { wrapper },
    );

    const ok = await result.current.handleSubmit(undefined as never);

    expect(ok).toBe(true);
    expect(onAfterAction).toHaveBeenCalledWith({ created: true, id: 42 });
  });

  it('passes { created: false } to onAfterAction after an update so the caller stays on the form', async () => {
    const services = makeServices(vi.fn());
    const onAfterAction = vi.fn();
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () =>
        useFormActions({
          form: { ...INITIAL_FORM } as EntityFormState,
          setForm: () => {},
          setSaving: () => {},
          services,
          id: '5',
          isEdit: true,
          navigate: () => {},
          buildPayload: () => ({}),
          onError: () => {},
          onAfterAction,
        }),
      { wrapper },
    );

    const ok = await result.current.handleSubmit(undefined as never);

    expect(ok).toBe(true);
    expect(onAfterAction).toHaveBeenCalledWith({ created: false });
  });

  it('passes { deleted: true } to onAfterAction after delete', async () => {
    const services = makeServices(vi.fn());
    services.delete = vi.fn().mockResolvedValue({});
    const onAfterAction = vi.fn();
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () =>
        useFormActions({
          form: { ...INITIAL_FORM } as EntityFormState,
          setForm: () => {},
          setSaving: () => {},
          services,
          id: '5',
          isEdit: true,
          navigate: () => {},
          buildPayload: () => ({}),
          onError: () => {},
          onAfterAction,
        }),
      { wrapper },
    );

    await result.current.handleDelete();

    expect(onAfterAction).toHaveBeenCalledWith({ deleted: true });
  });
});