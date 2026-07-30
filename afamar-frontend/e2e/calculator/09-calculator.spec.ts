/**
 * Calculator — interactive plate calculator.
 *
 * The calculator is a stateful widget (no API) — pieces are stored in
 * component state. We exercise the input → add → list → clear flow.
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

test.describe('Calculator', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('loads calculator page', async ({ page }) => {
    await page.goto('/admin/calculator');
    await expect(page.getByText(/calculadora de placa/i)).toBeVisible();
  });

  test('adds a piece and shows it in the list', async ({ page }) => {
    await page.goto('/admin/calculator');
    await expect(page.getByText(/calculadora de placa/i)).toBeVisible();

    // Fill the piece form. The inputs are identified by placeholder
    // (no associated labels).
    const inputs = page.locator('input[placeholder="0.00"]');
    await inputs.nth(0).fill('2.00'); // largo
    await inputs.nth(1).fill('1.50'); // ancho
    await page.getByRole('button', { name: /agregar pieza/i }).click();

    // The piece appears in the Piezas table. Each row shows "Largo" and "Ancho".
    await expect(page.locator('tbody tr', { hasText: '2.00' })).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: '1.50' })).toBeVisible();
  });

  test('clears all pieces when clicking Limpiar todo', async ({ page }) => {
    await page.goto('/admin/calculator');
    await expect(page.getByText(/calculadora de placa/i)).toBeVisible();

    // Add a piece first.
    const inputs = page.locator('input[placeholder="0.00"]');
    await inputs.nth(0).fill('1.00');
    await inputs.nth(1).fill('1.00');
    await page.getByRole('button', { name: /agregar pieza/i }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible();

    // Click "Limpiar todo".
    await page.getByRole('button', { name: /limpiar todo/i }).click();

    // The piece list is empty (the table shows an empty-state row).
    await expect(page.getByText(/no hay piezas agregadas/i)).toBeVisible();
  });

  test('updates plate dimensions and recalculates area', async ({ page }) => {
    await page.goto('/admin/calculator');
    await expect(page.getByText(/calculadora de placa/i)).toBeVisible();

    // Default plate is 3.00 x 1.80 = 5.40 m². The "Total" text shows this.
    await expect(page.getByText(/Total: 5\.40 m²/)).toBeVisible();

    // Change the first plate dimension to 2.00. New area = 2.00 * 1.80 = 3.60 m².
    const plateInputs = page.locator('input[type="number"]').filter({ hasText: '' });
    // The first plate input is the width (W).
    await plateInputs.first().fill('2.00');
    await expect(page.getByText(/Total: 3\.60 m²/)).toBeVisible();
  });
});
