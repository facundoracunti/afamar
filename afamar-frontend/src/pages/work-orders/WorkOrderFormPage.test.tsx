import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { INITIAL_FORM } from '../../hooks/entityFormConstants';
import type { EntityFormState } from '../../types';
import WorkOrderForm from './WorkOrderFormPage';

// The WhatsApp button lives in FormHeader (rendered for real); the whole
// EntityFormLayout body is mocked out so the test only exercises the header
// actions + the send-WhatsApp handler (token mint, message build, wa.me open).
vi.mock('../../components/entity/EntityFormLayout', () => ({
  __esModule: true,
  default: () => null,
}));

const h = vi.hoisted(() => {
  const entityForm = {
    form: {} as EntityFormState,
    loading: false,
    saving: false,
    materials: [],
    pools: [],
    clientes: [],
    paymentMethods: [],
    addOrRefreshClientes: vi.fn(),
    updateClientAddresses: vi.fn(),
    logoUrl: '',
    menuOpen: false,
    deleteConfirm: false,
    showCroquis: false,
    readOnly: false,
    hayUSD: false,
    hayAlternativas: false,
    isEdit: true,
    modoUSD: false,
    toggleModoUSD: vi.fn(),
    menuRef: { current: null },
    setForm: vi.fn(),
    setSaving: vi.fn(),
    setMenuOpen: vi.fn(),
    setDeleteConfirm: vi.fn(),
    setShowCroquis: vi.fn(),
    update: vi.fn(),
    handleTransportChange: vi.fn(),
    handleDepositCurrencyChange: vi.fn(),
    handleDepositAmountChange: vi.fn(),
    handleUsdRateChange: vi.fn(),
    handleDetailChange: vi.fn(),
    addDetalle: vi.fn(),
    removeDetalle: vi.fn(),
    addMaterial: vi.fn(),
    removeMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    addMaterialRow: vi.fn(),
    removeMaterialGroup: vi.fn(),
    updateMaterialGroup: vi.fn(),
    swapMaterialGroup: vi.fn(),
    addPileta: vi.fn(),
    removePileta: vi.fn(),
    updatePileta: vi.fn(),
    setPoolFields: vi.fn(),
    handleSubmit: vi.fn(),
    handleDelete: vi.fn(),
    handleStatusChangeAction: vi.fn(),
    handlePrint: vi.fn(),
    buildPayload: vi.fn(),
    M2_CONCEPTS: [],
    piecesFlow: {} as never,
  };

  const api = {
    getWorkOrder: vi.fn(),
    createWorkOrder: vi.fn(),
    updateWorkOrder: vi.fn(),
    deleteWorkOrder: vi.fn(),
    getNextWorkOrderNumber: vi.fn(),
    getWorkOrderPdf: vi.fn(),
    getWorkOrderPayments: vi.fn(),
    getWorkOrderPublicPdfToken: vi.fn(),
    // Legacy local-download helper — must NOT be called anymore by the
    // WhatsApp flow (kept in the mock to regression-guard its removal).
    getWorkOrderPdfBlob: vi.fn(),
  };

  const notifyMock = vi.fn();

  return { entityForm, api, notifyMock };
});

vi.mock('../../hooks/useEntityForm', () => ({
  __esModule: true,
  default: () => h.entityForm,
}));

vi.mock('@/api/resources/workOrders', () => h.api);

vi.mock('../../hooks/useWorkshopPdfController', () => ({
  useWorkshopPdfController: () => ({
    UI: null,
    handleOpenWorkshopSheet: vi.fn(),
    handleClosePdfPreview: vi.fn(),
    handleSketchImagesReady: vi.fn(),
  }),
}));

vi.mock('../../hooks/useSettingsWithTerms', () => ({
  useSettingsWithTerms: () => ({ company: {}, globalTerms: [] }),
}));

vi.mock('../../hooks/useUsdRate', () => ({
  useUsdRate: () => ({ refresh: vi.fn() }),
}));

vi.mock('../../hooks/useConfirmPayment', () => ({
  useConfirmPayment: () => vi.fn(),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotify: () => h.notifyMock,
}));

function makeForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return {
    ...INITIAL_FORM,
    status: 'MEASUREMENT',
    number: 'A-000123',
    client_name: 'María Pérez',
    client_phone: '+54 11 2345-6789',
    currency: 'ARS',
    total: 1234000,
    deposit_received: 617000,
    balance_due: 617000,
    ...overrides,
  } as EntityFormState;
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/admin/work-orders/123']}>
        <Routes>
          <Route path="/admin/work-orders/:id" element={<WorkOrderForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let openSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  h.entityForm.form = makeForm();
  h.notifyMock.mockClear();
  Object.values(h.api).forEach((fn) => fn.mockClear());
  // Clear any runtime/build-time public URL so each test starts clean.
  (window as unknown as Record<string, unknown>).APP_CONFIG = undefined;
  (import.meta.env as Record<string, unknown>).VITE_PUBLIC_URL = '';
});

afterEach(() => {
  openSpy?.mockRestore();
  openSpy = undefined;
  (window as unknown as Record<string, unknown>).APP_CONFIG = undefined;
  (import.meta.env as Record<string, unknown>).VITE_PUBLIC_URL = '';
});

describe('WorkOrderForm — WhatsApp send', () => {
  it('mints the signed public token, links the https public PDF, and NEVER downloads a local PDF', async () => {
    // Production-like runtime config: a public origin reachable by the client
    // (never localhost / the operator's dev port).
    (window as unknown as Record<string, unknown>).APP_CONFIG = {
      API_URL: '/api/v1',
      PUBLIC_URL: 'https://afamar.test',
    };
    h.api.getWorkOrderPublicPdfToken.mockResolvedValue({
      data: { token: 'abc.def', expires_in_days: 30, expires_at: '2026-10-21T00:00:00Z' },
    });
    h.api.getWorkOrderPayments.mockResolvedValue({ data: [] });
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR POR WHATSAPP' }));

    await waitFor(() => expect(openSpy).toHaveBeenCalled());

    expect(h.api.getWorkOrderPublicPdfToken).toHaveBeenCalledWith('123');
    expect(h.api.getWorkOrderPdfBlob).not.toHaveBeenCalled();

    const waUrl = openSpy.mock.calls[0][0] as string;
    const text = new URL(waUrl).searchParams.get('text') ?? '';
    expect(text).toMatch(/https:\/\//);
    expect(text).toContain('https://afamar.test/api/v1/public/work-orders/pdf?token=abc.def');
    expect(text).not.toContain('localhost');
    expect(text).not.toContain(':3090');
  });

  it('shows an error and does NOT open WhatsApp nor mint a token when the client has no phone', async () => {
    h.entityForm.form = makeForm({ client_phone: '' });
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR POR WHATSAPP' }));

    await waitFor(() => expect(h.notifyMock).toHaveBeenCalled());
    expect(h.notifyMock).toHaveBeenCalledWith(
      'El cliente no tiene teléfono cargado, no se puede enviar el WhatsApp.',
      'error',
    );
    expect(h.api.getWorkOrderPublicPdfToken).not.toHaveBeenCalled();
    expect(h.api.getWorkOrderPdfBlob).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });
});