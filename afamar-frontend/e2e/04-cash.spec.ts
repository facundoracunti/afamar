import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/login';

test.describe('Cash module', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('loads daily cash page with cards', async ({ page }) => {
    await page.goto('/admin/cash');
    // Page renders previous balance + income/expense total cards.
    await expect(page.getByText(/saldo anterior/i).first()).toBeVisible();
    await expect(page.getByText(/ingresos/i).first()).toBeVisible();
    await expect(page.getByText(/egresos/i).first()).toBeVisible();
  });

  test('navigates to cash history', async ({ page }) => {
    // Direct navigation — the sidebar accordion starts collapsed and clicking
    // the inner submenu link is intercepted by the closed submenu container.
    await page.goto('/admin/cash/history');
    await expect(page).toHaveURL(/\/admin\/cash\/history$/);
    // Verify the history page renders (header "Historial de Caja" via MainLayout
    // page-title + the table or empty state).
    await expect(page.getByText(/historial/i).first()).toBeVisible();
  });

  test('opens add income modal', async ({ page }) => {
    await page.goto('/admin/cash');
    await page.getByRole('button', { name: /agregar ingreso|nuevo ingreso/i }).first().click();
    await expect(page.getByRole('heading', { name: /agregar ingreso|nuevo ingreso/i })).toBeVisible();
  });

  test('opens add expense modal', async ({ page }) => {
    await page.goto('/admin/cash');
    await page.getByRole('button', { name: /agregar egreso|nuevo egreso/i }).first().click();
    await expect(page.getByRole('heading', { name: /agregar egreso|nuevo egreso/i })).toBeVisible();
  });
});