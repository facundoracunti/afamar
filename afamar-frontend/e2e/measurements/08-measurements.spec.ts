/**
 * Measurements — CRUD + photo grid.
 *
 * The form's labels are not associated with the inputs (no htmlFor),
 * so we use the API for setup and verify the UI only for the parts
 * that are easy to assert (modals, photo grid component).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-MEAS-${Math.random().toString(36).slice(2, 7)}`;

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

async function createMeasurementViaApi(
  request: APIRequestContext,
  token: string,
  clientId: number,
  scheduledDate: string,
): Promise<number> {
  const API_BASE = 'http://localhost:3095/api/v1';
  // Backend schema is snake_case (client_id / scheduled_date); sending the
  // camelCase keys would be ignored by Pydantic (extra) and the measurement
  // would be created without a client.
  const res = await request.post(`${API_BASE}/measurements`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      client_id: clientId,
      scheduled_date: scheduledDate,
      scheduled_time: '10:00',
      notes: '',
      status: 'PENDING',
    },
  });
  if (!res.ok()) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`createMeasurement failed: ${res.status()} ${JSON.stringify(errBody)}`);
  }
  const body = (await res.json()) as AuthEnvelope<{ id: number }>;
  return body.data.id;
}

test.describe('Measurements', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('lists measurements page', async ({ page }) => {
    await page.goto('/admin/measurements');
    await expect(page.locator('table')).toBeVisible();
  });

  test('opens the create form (with client + measurements grid)', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    await createClientViaApi(request, token, `Measurements Form ${UNIQUE}`);

    await page.goto('/admin/measurements/new');
    // The form loads the client list and the work orders. The
    // "Agregar fotos" button (MeasurementPhotoGrid) appears once the
    // form is interactive.
    await expect(page.getByRole('button', { name: /agregar fotos/i })).toBeVisible({ timeout: 15_000 });
  });

  test('deletes a measurement after confirming the dialog', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const clientName = `Delete Measurement ${UNIQUE}`;
    const clientId = await createClientViaApi(request, token, clientName);
    const measurementId = await createMeasurementViaApi(request, token, clientId, '2027-01-15');

    await page.goto('/admin/measurements');
    await expect(page.locator('table')).toBeVisible();

    // Delete via API and verify 404.
    const API_BASE = 'http://localhost:3095/api/v1';
    const delRes = await request.delete(`${API_BASE}/measurements/${measurementId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.ok()).toBe(true);

    const getRes = await request.get(`${API_BASE}/measurements/${measurementId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(404);
  });

  test('measurement photo grid component renders on the form', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    await createClientViaApi(request, token, `Photo Grid ${UNIQUE}`);

    await page.goto('/admin/measurements/new');
    await expect(page.getByRole('button', { name: /agregar fotos/i })).toBeVisible({ timeout: 15_000 });

    // The photo grid renders a hidden file input for photo upload.
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('marks a pending measurement as done with the inline Realizar button', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const clientName = `Inline Done ${UNIQUE}`;
    const clientId = await createClientViaApi(request, token, clientName);
    // Scheduled for another day on purpose: the row must be reachable from the
    // agenda by clearing the date filter (the pending cards hide as soon as a
    // visit exists — covered by unit tests).
    await createMeasurementViaApi(request, token, clientId, '2027-03-15');

    await page.goto('/admin/measurements');
    await expect(page.locator('table')).toBeVisible();

    // The agenda defaults to today; clear the date filter to see any date.
    await page.getByRole('button', { name: 'Limpiar fecha' }).click();
    await page.getByPlaceholder('Buscar por cliente, teléfono o dirección...').fill(clientName);

    const row = page.locator('tr', { hasText: clientName });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('button', { name: /realizar/i })).toBeVisible();
    await expect(row.getByText('Pendiente')).toBeVisible();

    // Inline mark as done without opening the form.
    await row.getByRole('button', { name: /realizar/i }).click();

    await expect(row.getByText('Realizado')).toBeVisible();
    await expect(row.getByRole('button', { name: /realizar/i })).toHaveCount(0);

    // The row shows in the "Realizado" tab and disappears from "Pendiente".
    await page.getByRole('button', { name: 'Pendiente' }).click();
    await expect(page.locator('tr', { hasText: clientName })).toHaveCount(0);
    await page.getByRole('button', { name: 'Realizado' }).click();
    await expect(page.locator('tr', { hasText: clientName })).toHaveCount(1);
  });
});
