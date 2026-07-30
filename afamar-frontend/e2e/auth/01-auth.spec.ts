import { test, expect } from '@playwright/test';
import { ADMIN_USER, loginAsAdmin, logout } from '../helpers/login';

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

  test('logout clears localStorage and redirects to /login', async ({ page }) => {
    await loginAsAdmin(page);
    // sanity: we have a token before logout
    const tokenBefore = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenBefore).toBeTruthy();

    // Open the profile dropdown (User icon in the topbar) and click "Cerrar sesión".
    await page.getByRole('button', { name: 'Perfil' }).click();
    await page.getByRole('button', { name: /cerrar sesi[oó]n/i }).click();

    await expect(page).toHaveURL(/\/login$/);
    const tokenAfter = await page.evaluate(() => localStorage.getItem('auth_token'));
    const userAfter = await page.evaluate(() => localStorage.getItem('auth_user'));
    expect(tokenAfter).toBeNull();
    expect(userAfter).toBeNull();
  });

  test('visiting a protected route without a token redirects to /login', async ({ page, request }) => {
    // Make sure we're logged out.
    await logout(page);
    await page.goto('/admin/cash');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an invalid token in localStorage is cleared and redirects to /login', async ({ page }) => {
    // Seed an obviously-invalid token, then try to load a protected page.
    // The AuthContext bootstraps from localStorage and the api interceptor
    // (401) clears it on the first protected call. We assert the result.
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'not-a-real-jwt');
      localStorage.setItem('auth_user', JSON.stringify({ id: 1, username: 'fake' }));
    });
    await page.goto('/admin');

    // Either the AuthContext rejects the malformed token immediately,
    // or the first protected API call returns 401 and the interceptor
    // clears localStorage + redirects. Both paths land on /login.
    await expect(page).toHaveURL(/\/login$/);
    const tokenAfter = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenAfter).toBeNull();
  });
});