/**
 * Additional Works catalogue — CRUD via the modal-based form.
 *
 * The form has labels but no `htmlFor` associations, so we use
 * placeholders to target inputs. Create + delete are exercised both
 * through the UI (modal + ConfirmDialog) and verified via API.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-AW-${Math.random().toString(36).slice(2, 7)}`;

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

async function createAdditionalWorkViaApi(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<number> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.post(`${API_BASE}/additional-works`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      detail: 'E2E test work',
      price: 500,
      currency: 'ARS',
      type: 'flat',
    },
  });
  if (!res.ok()) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`createAdditionalWork failed: ${res.status()} ${JSON.stringify(errBody)}`);
  }
  const body = (await res.json()) as AuthEnvelope<{ id: number }>;
  return body.data.id;
}

test.describe('Additional Works', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('lists additional works page', async ({ page }) => {
    await page.goto('/admin/additional-works');
    await expect(page.locator('table')).toBeVisible();
  });

  test('opens the create modal', async ({ page }) => {
    await page.goto('/admin/additional-works');
    await expect(page.locator('table')).toBeVisible();

    // Click "Nuevo Trabajo Adicional" to open the create modal.
    await page.getByRole('button', { name: /nuevo trabajo adicional/i }).click();

    // The modal opens with the title "Nuevo Trabajo Adicional".
    await expect(page.getByRole('dialog')).toBeVisible();

    // The form has a "Nombre" input with a descriptive placeholder.
    await expect(page.getByPlaceholder(/pulido de bordes/i)).toBeVisible();

    // Close via the Cancel button.
    await page.getByRole('button', { name: /^cancelar$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('creates a new additional work via the modal', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const name = `CreateAW ${UNIQUE}`;

    await page.goto('/admin/additional-works');
    await expect(page.locator('table')).toBeVisible();

    // Open the create modal.
    await page.getByRole('button', { name: /nuevo trabajo adicional/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill the name (placeholder doesn't have the actual value, so use
    // the first input in the form).
    const nameInput = page.getByPlaceholder(/pulido de bordes/i);
    await nameInput.fill(name);

    // Submit the form (Crear button).
    const postResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/additional-works') && r.request().method() === 'POST' && r.ok(),
    );
    await page.getByRole('button', { name: /^crear$/i }).click();
    await postResponsePromise;

    // The modal closes.
    await expect(page.getByRole('dialog')).toBeHidden();

    // Verify the new additional work was created via API.
    const API_BASE = 'http://localhost:3095/api/v1';
    const res = await request.get(`${API_BASE}/additional-works?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as AuthEnvelope<Array<{ id: number; name: string }>>;
    const created = body.data.find((w) => w.name === name);
    expect(created).toBeDefined();
  });

  test('deletes an additional work after confirming the dialog', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const name = `DeleteAW ${UNIQUE}`;
    const id = await createAdditionalWorkViaApi(request, token, name);

    await page.goto('/admin/additional-works');
    await expect(page.locator('table')).toBeVisible();

    // The list endpoint doesn't support search reliably (same as
    // clients/budgets), so we use the API to find the row directly.
    // The table shows the new item within the first page (the seed
    // only has 2 additional works, so positions are predictable).
    const row = page.locator('tbody tr', { hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Click the trash button (last button in the row's actions).
    const rowButtons = row.locator('button');
    await rowButtons.last().click();

    // Confirm the dialog. The "Eliminar" button is inside the dialog
    // (the row's trash button also has name "Eliminar" via the title
    // attribute, so we scope to the dialog).
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /^eliminar$/i }).click();

    // Wait for the row to disappear.
    await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(0, { timeout: 10_000 });

    // Verify via API.
    const API_BASE = 'http://localhost:3095/api/v1';
    const res = await request.get(`${API_BASE}/additional-works?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as AuthEnvelope<Array<{ id: number; name: string }>>;
    expect(body.data.find((w) => w.id === id)).toBeUndefined();
  });
});
