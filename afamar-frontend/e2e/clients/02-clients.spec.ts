import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-${Math.random().toString(36).slice(2, 7)}`;

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

test.describe('Clients', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('lists clients page', async ({ page }) => {
    await page.goto('/admin/clients');
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  });

  test('creates a new client and finds it in the list', async ({ page, request }) => {
    const name = `Juan Pérez ${UNIQUE}`;

    await page.goto('/admin/clients/new');
    const inputs = page.locator('input.input, textarea.input');
    await inputs.nth(0).fill(name);
    await inputs.nth(1).fill('+54 11 5555-1234');
    await inputs.nth(2).fill(`juan.${UNIQUE}@example.com`);
    await inputs.nth(3).fill('Av. Test 1234, CABA');

    await page.getByRole('button', { name: /crear cliente/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients$/);

    // Use the SearchInput to narrow down to our new client (the
    // SearchInput now hits /clients/search?q= which filters correctly).
    const search = page.getByPlaceholder(/buscar por nombre/i);
    await search.fill(name);
    await expect(page.locator('tbody tr', { hasText: name })).toBeVisible({ timeout: 10_000 });
  });

  test('edits an existing client', async ({ page }) => {
    const name = `Edit Me ${UNIQUE}`;

    // Create via UI.
    await page.goto('/admin/clients/new');
    const inputs = page.locator('input.input, textarea.input');
    await inputs.nth(0).fill(name);
    await page.getByRole('button', { name: /crear cliente/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients$/);

    // Filter by name.
    const search = page.getByPlaceholder(/buscar por nombre/i);
    await search.fill(name);
    const row = page.locator('tbody tr', { hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Click the edit button (first button in the row).
    await row.locator('button').first().click();
    await expect(page).toHaveURL(/\/admin\/clients\/\d+$/);
    await expect(page.getByRole('heading', { name: /editar cliente/i })).toBeVisible();

    // Update the phone.
    const phoneInput = page.locator('input.input, textarea.input').nth(1);
    await phoneInput.fill('+54 11 9999-0000');

    await page.getByRole('button', { name: /actualizar/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients$/);

    // Verify the change persisted via SearchInput.
    const search2 = page.getByPlaceholder(/buscar por nombre/i);
    await search2.fill(name);
    await expect(page.locator('tbody tr', { hasText: '+54 11 9999-0000' })).toBeVisible({ timeout: 10_000 });
  });

  test('deletes a client after confirming the dialog', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const name = `Delete Me ${UNIQUE}`;

    // 1. Create via API (faster + deterministic).
    await createClientViaApi(request, token, name);

    await page.goto('/admin/clients');
    await expect(page.locator('table')).toBeVisible();

    // 2. Filter by name (uses the new /clients/search endpoint).
    const search = page.getByPlaceholder(/buscar por nombre/i);
    await search.fill(name);
    const row = page.locator('tbody tr', { hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // 3. Click the trash button (second action button in the row).
    await row.locator('button').nth(1).click();

    // 4. Confirm the dialog.
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /^eliminar$/i }).click();

    // 5. The row is gone.
    await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(0);
  });

  test('search filters the list in real time', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const target = `SearchTarget ${UNIQUE}`;
    const decoy = `Decoy ${UNIQUE}`;
    await createClientViaApi(request, token, target);
    await createClientViaApi(request, token, decoy);

    await page.goto('/admin/clients');
    await expect(page.locator('table')).toBeVisible();

    const search = page.getByPlaceholder(/buscar por nombre/i);
    await search.fill(target);

    // Only the matching row is rendered.
    await expect(page.locator('tbody tr', { hasText: target })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('tbody tr', { hasText: decoy })).toHaveCount(0);
  });

  test('blocks submit when the required name field is empty', async ({ page }) => {
    await page.goto('/admin/clients/new');
    await page.getByRole('button', { name: /crear cliente/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients\/new$/);
  });
});
