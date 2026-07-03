import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Cash module', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('loads daily cash page with cards', async ({ page }) => {
    await page.goto('/admin/cash');
    // Page renders previous balance + income/expense total cards.
    await expect(page.getByText(/saldo anterior/i).first()).toBeVisible();
    await expect(page.getByText(/ingresos/i).first()).toBeVisible();
    await expect(page.getByText(/egresos/i).first()).toBeVisible();
  });

  test('navigates to cash history', async ({ page }) => {
    await page.goto('/admin/cash');
    await page.getByRole('link', { name: /historial/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/cash\/history$/);
  });

  test('opens add income modal', async ({ page }) => {
    await page.goto('/admin/cash');
    await page.getByRole('button', { name: /nuevo ingreso/i }).first().click();
    await expect(page.getByRole('heading', { name: /nuevo ingreso/i })).toBeVisible();
  });

  test('opens add expense modal', async ({ page }) => {
    await page.goto('/admin/cash');
    await page.getByRole('button', { name: /nuevo egreso/i }).first().click();
    await expect(page.getByRole('heading', { name: /nuevo egreso/i })).toBeVisible();
  });
});