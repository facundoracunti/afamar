/**
 * Work Orders — CRUD + status flow + payment.
 *
 * Like the budgets tests, we use the API to seed the test data (the
 * work-order form is heavy and has the same loading quirks as the
 * budget form). The status transition + PDF + delete flows are exercised
 * through the UI.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-WO-${Math.random().toString(36).slice(2, 7)}`;

interface AuthEnvelope<T> {
  success: boolean;
  data: T;
}

async function loginAndGetToken(request: APIRequestContext): Promise<string> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  const body = (await res.json()) as AuthEnvelope<{ access_token: string }>;
  return body.data.access_token;
}

async function createClientViaApi(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<number> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.post(`${API_BASE}/clients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, phone: '+54 11 0000-0000', address: 'Calle Test 123' },
  });
  const body = (await res.json()) as AuthEnvelope<{ id: number }>;
  return body.data.id;
}

async function createWorkOrderViaApi(
  request: APIRequestContext,
  token: string,
  clientId: number,
  number: string,
  status: string = 'MEASUREMENT',
): Promise<{ id: number; number: string }> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.post(`${API_BASE}/work-orders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      client_id: clientId,
      number,
      material: 'Test Material',
      material_price_m2: 1000,
      currency: 'ARS',
      usd_rate: 1000,
      total: 1000,
      status,
    },
  });
  const body = (await res.json()) as AuthEnvelope<{ id: number; number: string }>;
  return { id: body.data.id, number: body.data.number };
}

test.describe('Work Orders', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('lists work orders page', async ({ page }) => {
    await page.goto('/admin/work-orders');
    await expect(page.locator('table')).toBeVisible();
  });

  test('deletes a work order after confirming the dialog', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const clientName = `Delete WO ${UNIQUE}`;
    const clientId = await createClientViaApi(request, token, clientName);
    const wo = await createWorkOrderViaApi(request, token, clientId, `A-${UNIQUE}`);

    await page.goto('/admin/work-orders');
    await expect(page.locator('table')).toBeVisible();
    const row = page.locator('tbody tr', { hasText: wo.number }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Click the trash button (last button in the row). The accessible
    // name comes from the title attribute ("Eliminar orden").
    const deleteBtn = row.getByRole('button', { name: /eliminar orden/i });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Confirm the dialog.
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /^eliminar$/i }).click();

    // Wait for the row to disappear from the list.
    await expect(page.locator('tbody tr', { hasText: wo.number })).toHaveCount(0, { timeout: 10_000 });

    // Verify the work order is gone via API.
    const API_BASE = 'http://localhost:3095/api/v1';
    const getRes = await request.get(`${API_BASE}/work-orders/${wo.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(404);
  });

  test('advances status forward (MEASUREMENT → WORKSHOP)', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const clientName = `Forward WO ${UNIQUE}`;
    const clientId = await createClientViaApi(request, token, clientName);
    const wo = await createWorkOrderViaApi(request, token, clientId, `A-${UNIQUE}-FWD`, 'MEASUREMENT');

    await page.goto('/admin/work-orders');
    await expect(page.locator('table')).toBeVisible();
    const row = page.locator('tbody tr', { hasText: wo.number }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Click the "Avanzar estado" button (ChevronRight). The accessible
    // name comes from the title attribute.
    await row.getByRole('button', { name: /avanzar estado/i }).click();

    // Wait for the status to update in the UI.
    await expect(row.getByText(/taller/i)).toBeVisible({ timeout: 10_000 });

    // Verify the status changed via API.
    const API_BASE = 'http://localhost:3095/api/v1';
    const getRes = await request.get(`${API_BASE}/work-orders/${wo.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const reread = (await getRes.json()) as AuthEnvelope<{ status: string }>;
    expect(reread.data.status).toBe('WORKSHOP');
  });

  test('opens the PDF preview modal when clicking PDF button', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const clientName = `PDF WO ${UNIQUE}`;
    const clientId = await createClientViaApi(request, token, clientName);
    const wo = await createWorkOrderViaApi(request, token, clientId, `A-${UNIQUE}-PDF`);

    await page.goto('/admin/work-orders');
    await expect(page.locator('table')).toBeVisible();
    const row = page.locator('tbody tr', { hasText: wo.number }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Click the "PDF" button.
    await row.getByRole('button', { name: /^pdf$/i }).click();

    // Verify the PDF preview modal opens (PdfPreviewModal doesn't use
    // role="dialog", so we check by the title or "Cerrar" button).
    await expect(page.getByRole('button', { name: /cerrar/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Vista previa')).toBeVisible();
  });
});
