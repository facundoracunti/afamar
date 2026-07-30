/**
 * Product Photos — CRUD.
 *
 * File upload is complex (multipart + image processing on the server)
 * so we focus on loading the page + verifying the API endpoints. The
 * gallery is paginated and shows only the latest 12 photos, so
 * targeting a specific row in the UI is unreliable.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

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

test.describe('Product Photos', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('loads product photos page', async ({ page }) => {
    await page.goto('/admin/product-photos');
    // The page has an upload form with a "Subir foto" button.
    await expect(page.getByRole('button', { name: /subir foto/i })).toBeVisible();
  });

  test('latest product photos endpoint returns a list', async ({ request }) => {
    const token = await loginAndGetToken(request);
    const API_BASE = 'http://localhost:3095/api/v1';
    const res = await request.get(`${API_BASE}/product-photos/latest?limit=12`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as AuthEnvelope<Array<unknown>>;
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('upload form inputs are present', async ({ page }) => {
    await page.goto('/admin/product-photos');
    await expect(page.getByRole('button', { name: /subir foto/i })).toBeVisible();

    // The form has a hidden file input. The title + description
    // inputs are conditionally rendered (only when a file is selected).
    // Just verify the file input is in the DOM.
    await expect(page.locator('input[type="file"]')).toBeAttached();
  });
});
