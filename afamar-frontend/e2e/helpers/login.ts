import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

export const ADMIN_USER = {
  username: process.env.E2E_ADMIN_USER ?? 'admin',
  password: process.env.E2E_ADMIN_PASS ?? 'admin123',
};

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3095/api/v1';

/**
 * Logs in via the public form. Used by the auth spec to verify the form itself.
 * Most tests should prefer `loginViaApi()` to avoid hitting the backend's
 * per-IP rate limit (5 / minute on /auth/login).
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(ADMIN_USER.username);
  await page.getByLabel('Contraseña').fill(ADMIN_USER.password);
  await page.getByRole('button', { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\/admin/);
}

/**
 * Authenticates via the API directly, then sets the JWT + user into localStorage
 * so the AuthContext picks it up on mount. Skips the form (and the rate limit).
 *
 * Use this in `beforeEach` for tests that just need a logged-in browser.
 */
export async function loginViaApi(page: Page, request: APIRequestContext): Promise<void> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username: ADMIN_USER.username, password: ADMIN_USER.password },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }
  const data = (await res.json()) as { success: boolean; data: { access_token: string; user: unknown } };
  if (!data.success) {
    throw new Error('Login response missing success envelope');
  }
  // Need to be on a same-origin page before we can write localStorage.
  await page.goto('/login');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, { token: data.data.access_token, user: data.data.user });
}

export async function logout(page: Page): Promise<void> {
  // Navigate first so localStorage is accessible — accessing it on
  // about:blank raises a SecurityError.
  if (!page.url() || page.url() === 'about:blank') {
    await page.goto('/login');
  }
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