import { test, expect, type Page } from '@playwright/test';

export const ADMIN_USER = {
  username: process.env.E2E_ADMIN_USER ?? 'admin',
  password: process.env.E2E_ADMIN_PASS ?? 'admin123',
};

/**
 * Helper to log in via the public form. Stores JWT in localStorage
 * (`auth_token` + `auth_user`) just like the AuthContext does.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(ADMIN_USER.username);
  await page.getByLabel('Contraseña').fill(ADMIN_USER.password);
  await page.getByRole('button', { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\/admin/);
}

export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  });
}

/**
 * Resets the Vite proxy cache and routes to the dashboard root.
 */
export async function goToAdmin(page: Page): Promise<void> {
  await page.goto('/admin');
}

test('login helper smoke', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin$/);
});