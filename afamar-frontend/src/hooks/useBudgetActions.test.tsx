import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { EntityFormState } from '@/types';
import type { BudgetOption, BudgetPiece } from '@/types/budget';
import { INITIAL_FORM } from './entityFormConstants';

// ── Mocks ────────────────────────────────────────────────────────────

const convertMock = vi.fn();
const updateMock = vi.fn();
const notifyMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/api/resources/budgets', () => ({
  convertBudgetOptionToWorkOrder: (...args: unknown[]) => convertMock(...args),
  convertAlternativeToWorkOrder: vi.fn(),
  convertBudgetToWorkOrder: vi.fn(),
  getBudgetPublicPdfToken: vi.fn(async () => ({ data: { token: 't' } })),
  updateBudget: (...args: unknown[]) => updateMock(...args),
  createBudget: vi.fn(),
  sendBudgetWhatsApp: vi.fn(),
  sendBudgetEmail: vi.fn(),
  getNextBudgetNumber: vi.fn(),
  getBudgetPdf: vi.fn(),
  getBudget: vi.fn(),
  listBudgets: vi.fn(),
  deleteBudget: vi.fn(),
}));

vi.mock('../context/NotificationContext', () => ({
  useNotify: () => notifyMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('./useSettingsWithTerms', () => ({
  useSettingsWithTerms: () => ({
    company: {
      company_name: 'AFAMAR', company_tagline: '', company_address: '',
      company_phone: '', company_email: '', company_logo: '', pdf_footer: '',
    },
    globalTerms: { budget_terms: [], delivery_terms: [], warranty_text: [] },
    loading: false,
  }),
}));

import { useBudgetActions } from './useBudgetActions';

// ── Fixtures ─────────────────────────────────────────────────────────

function piece(name: string): BudgetPiece {
  return {
    id: `p-${name}`,
    name,
    mainMaterial: {
      id: 1, name: 'CALACATTA', price_m2: 100000, price_m2_usd: 0,
      currency: 'ARS', quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: false,
    },
    alternativeMaterials: [],
    fabrication_details: [],
    additional_works_data: '[]',
    pools: [],
  };
}

function option(id: string, name: string, selected: boolean): BudgetOption {
  return { id, name, is_selected: selected, pieces: [piece(name)] };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function setup(options: BudgetOption[]) {
  const form = {
    ...INITIAL_FORM,
    pieces: (options.find((o) => o.is_selected) ?? options[0])?.pieces ?? [],
    options,
    active_option_id: (options.find((o) => o.is_selected) ?? options[0])?.id ?? '',
    number: 'P-000001',
    status: 'APPROVED',
  } as unknown as EntityFormState;

  let formRef = form;
  const setForm = ((updater: unknown) => {
    formRef = (typeof updater === 'function'
      ? (updater as (p: EntityFormState) => EntityFormState)(formRef)
      : updater) as EntityFormState;
  }) as React.Dispatch<React.SetStateAction<EntityFormState>>;

  const hook = renderHook(
    () =>
      useBudgetActions({
        form: formRef,
        setForm,
        setSaving: vi.fn(),
        saving: false,
        buildPayload: () => ({}),
        isEdit: true,
        id: '1',
      }),
    { wrapper },
  );
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({ data: {} });
});

// ── Tests ───────────────────────────────────────────────────────────

describe('useBudgetActions — convert to WO from the winning option (Fase 3)', () => {
  it('posts the winning option id to /budgets/{id}/convert', async () => {
    convertMock.mockResolvedValue({
      data: {
        work_order: { id: 55, number: 'A-000055' },
        option_id: 'opt-2',
        option_name: 'Opción 2',
      },
    });
    const { result } = setup([
      option('opt-1', 'Opción 1', false),
      option('opt-2', 'Opción 2', true),
    ]);

    await act(async () => {
      await result.current.handleConvertirGuardar();
    });

    await waitFor(() => expect(convertMock).toHaveBeenCalledTimes(1));
    // (id, optionId) — the winning option is the marked one.
    expect(convertMock).toHaveBeenCalledWith('1', 'opt-2');
    // The budget is saved first (so the option edits are persisted).
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/admin/work-orders/55');
  });

  it('BLOCKS and notifies when no option is marked as the winner', async () => {
    // Two options, none selected → ambiguous. The UI must not fire an
    // ambiguous request (it would bill the wrong price and deduct the
    // wrong sink).
    const { result } = setup([
      option('opt-1', 'Opción 1', false),
      option('opt-2', 'Opción 2', false),
    ]);

    await act(async () => {
      await result.current.handleConvertirGuardar();
    });

    expect(convertMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      expect.stringContaining('ganadora'),
      'error',
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('BLOCKS when two options are marked as winners', async () => {
    const { result } = setup([
      option('opt-1', 'Opción 1', true),
      option('opt-2', 'Opción 2', true),
    ]);

    await act(async () => {
      await result.current.handleConvertirGuardar();
    });

    expect(convertMock).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(expect.stringContaining('ganadora'), 'error');
  });

  it('converts a legacy single-option budget without an option id conflict', async () => {
    // No options at all → resolves to the synthetic SINGLE id, which the
    // backend understands. The legacy flow must keep working.
    convertMock.mockResolvedValue({
      data: {
        work_order: { id: 77, number: 'A-000077' },
        option_id: 'SINGLE',
        option_name: 'Opción Única',
      },
    });
    const form = {
      ...INITIAL_FORM,
      pieces: [piece('COCINA')],
      options: [],
      active_option_id: '',
      number: 'P-000002',
      status: 'APPROVED',
    } as unknown as EntityFormState;
    const setForm = vi.fn() as unknown as React.Dispatch<React.SetStateAction<EntityFormState>>;

    const { result } = renderHook(
      () =>
        useBudgetActions({
          form,
          setForm,
          setSaving: vi.fn(),
          saving: false,
          buildPayload: () => ({}),
          isEdit: true,
          id: '2',
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleConvertirGuardar();
    });

    expect(convertMock).toHaveBeenCalledWith('2', 'SINGLE');
  });

  it('surfaces a backend rejection without navigating', async () => {
    convertMock.mockRejectedValue(new Error('El presupuesto tiene varias opciones'));
    const { result } = setup([
      option('opt-1', 'Opción 1', true),
      option('opt-2', 'Opción 2', false),
    ]);

    await act(async () => {
      await result.current.handleConvertirGuardar();
    });

    expect(convertMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});