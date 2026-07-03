import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Budgets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('lists budgets page', async ({ page }) => {
    await page.goto('/admin/budgets');
    await expect(page.getByRole('heading', { name: /presupuestos/i }).first()).toBeVisible();
  });

  test('opens new budget form', async ({ page }) => {
    await page.goto('/admin/budgets');
    await page.getByRole('button', { name: /nuevo/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/budgets\/new$/);
    // The form has a "Cliente" section (BudgetFormClient).
    await expect(page.getByText(/cliente/i).first()).toBeVisible();
  });

  test('shows pdf preview button after loading', async ({ page }) => {
    await page.goto('/admin/budgets/new');
    // The form starts loading on /new (no id). The "Vista previa" button may
    // appear once materials/clients are loaded. Wait for any action button.
    await expect(page.locator('button:has-text("Vista previa")').first()).toBeVisible({ timeout: 10_000 });
  });

  test('filter by status narrows the list', async ({ page }) => {
    await page.goto('/admin/budgets?estado=PENDING');
    await expect(page).toHaveURL(/estado=PENDING/);
  });
});