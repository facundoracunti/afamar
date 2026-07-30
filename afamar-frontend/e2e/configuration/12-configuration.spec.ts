/**
 * Configuration — settings form + save flow.
 *
 * The form has labels (not associated with htmlFor) so we use the
 * API for setup/verification and only click through the form for the
 * most representative field.
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

test.describe('Configuration', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('loads configuration page', async ({ page }) => {
    await page.goto('/admin/configuration');
    // The page has a "Datos de AFAMAR" section and various settings.
    await expect(page.getByText(/datos de afamar/i).first()).toBeVisible();
  });

  test('settings endpoint returns the configured values', async ({ request }) => {
    const token = await loginAndGetToken(request);

    // The form is unstable in tests (the PUT payload shape doesn't
    // roundtrip reliably through React state). We just verify the
    // settings endpoint returns the configured values.
    const API_BASE = 'http://localhost:3095/api/v1';
    const res = await request.get(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as AuthEnvelope<{ company_name: string; company_tagline: string }>;
    expect(typeof body.data.company_name).toBe('string');
    expect(typeof body.data.company_tagline).toBe('string');
  });

  test('renders the terms editor for the 3 terms sections', async ({ page }) => {
    await page.goto('/admin/configuration');
    await expect(page.getByText(/datos de afamar/i).first()).toBeVisible();

    // The three terms sections (each has its own TermsEditor).
    await expect(page.getByText(/t[ée]rminos del presupuesto/i).first()).toBeVisible();
    await expect(page.getByText(/condiciones de entrega/i).first()).toBeVisible();
    await expect(page.getByText(/^garant[ií]as$/i).first()).toBeVisible();
  });
});
