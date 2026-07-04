import { test, expect } from '@playwright/test';
import { ADMIN_USER, loginAsAdmin, logout } from './helpers/login';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await logout(page);
  });

  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('rejects bad credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Usuario').fill(ADMIN_USER.username);
    await page.getByLabel('Contraseña').fill('wrong-password');
    await page.getByRole('button', { name: /ingresar/i }).click();
    await expect(page.getByText(/inválid|credencial|error/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logs in with valid admin credentials', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin$/);
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
  });

  test('legacy Spanish paths redirect to English equivalents', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/presupuestos');
    await expect(page).toHaveURL(/\/admin\/budgets$/);
    await page.goto('/ordenes');
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await page.goto('/stock-piletas');
    await expect(page).toHaveURL(/\/admin\/pool-stock$/);
  });
});