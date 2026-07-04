import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/login';

const UNIQUE = `E2E-${Date.now()}`;

test.describe('Clients', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('lists clients page', async ({ page }) => {
    await page.goto('/admin/clients');
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  });

  test('creates a new client and finds it in the list', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.getByRole('button', { name: /nuevo cliente/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients\/new$/);

    // Form fields in order: Nombre*, Teléfono, Email, Dirección, Observaciones
    const inputs = page.locator('input.input, textarea.input');
    await inputs.nth(0).fill(`Juan Pérez ${UNIQUE}`);
    await inputs.nth(1).fill('+54 11 5555-1234');
    await inputs.nth(2).fill(`juan.${UNIQUE}@example.com`);
    await inputs.nth(3).fill('Av. Test 1234, CABA');

    await page.getByRole('button', { name: /crear cliente/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients$/);

    await page.locator('input.input').first().fill(`Juan Pérez ${UNIQUE}`);
    await expect(page.getByText(`Juan Pérez ${UNIQUE}`)).toBeVisible();
  });

  test('edits an existing client', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.locator('input.input').first().fill(`Juan Pérez ${UNIQUE}`);

    // Click the first row's edit button
    const firstRow = page.locator('tbody tr', { hasText: `Juan Pérez ${UNIQUE}` }).first();
    await firstRow.locator('button').first().click();
    await expect(page).toHaveURL(/\/admin\/clients\/\d+$/);

    await expect(page.getByRole('heading', { name: /editar cliente/i })).toBeVisible();
    const phoneInput = page.locator('input.input, textarea.input').nth(1);
    await phoneInput.fill('+54 11 9999-0000');

    await page.getByRole('button', { name: /actualizar/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients$/);
  });
});