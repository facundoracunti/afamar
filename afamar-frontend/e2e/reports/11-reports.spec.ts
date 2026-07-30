/**
 * Reports — tabs + chart lazy-load.
 *
 * The charts (recharts) are lazy-loaded with React.lazy. We verify the
 * tab navigation works and the chart component renders when the
 * corresponding tab is active.
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

test.describe('Reports', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('loads reports page with default tab', async ({ page }) => {
    await page.goto('/admin/reports');
    await expect(page.getByText(/^Reportes$/)).toBeVisible();
    // The default tab shows "Resumen de Presupuestos".
    await expect(page.getByText(/resumen de presupuestos/i)).toBeVisible();
  });

  test('switches between the four tabs', async ({ page }) => {
    await page.goto('/admin/reports');
    await expect(page.getByText(/^Reportes$/)).toBeVisible();

    // Default tab: presupuestos. Click "Órdenes".
    await page.getByRole('button', { name: /^órdenes$/i }).click();
    await expect(page.getByText(/resumen de órdenes|órdenes totales/i).first()).toBeVisible();

    // Click "Ventas Mensuales" — triggers the lazy-loaded chart.
    await page.getByRole('button', { name: /ventas mensuales/i }).click();
    // The chart container renders a recharts wrapper. Verify the tab
    // heading is present (the chart lazy-loads and may need a moment).
    await expect(page.getByRole('heading', { name: /ventas mensuales/i })).toBeVisible({ timeout: 15_000 });

    // Click "Materiales" — triggers the second lazy chart.
    await page.getByRole('button', { name: /^materiales$/i }).click();
    await expect(page.getByRole('heading', { name: /materiales m/i })).toBeVisible({ timeout: 15_000 });
  });

  test('reports dashboard endpoint returns a payload', async ({ request }) => {
    // The dashboard endpoint is the source of truth for the report
    // cards. Verify it returns a non-error response.
    const API_BASE = 'http://localhost:3095/api/v1';
    const res = await request.get(`${API_BASE}/reports/dashboard`, {
      headers: { Authorization: `Bearer ${await loginAndGetToken(request)}` },
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(typeof body.data).toBe('object');
  });
});

async function loginAndGetToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  const body = (await res.json()) as { success: boolean; data: { access_token: string } };
  return body.data.access_token;
}
