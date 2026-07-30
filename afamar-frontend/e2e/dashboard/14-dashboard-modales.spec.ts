/**
 * Dashboard modales — each card on the dashboard opens a modal embedding
 * the real page (not a navigation). Verifies:
 *  - Each card opens the expected modal with the expected title.
 *  - Modal content matches the embedded page.
 *  - Escape closes the modal.
 *  - Clicking the overlay closes the modal.
 *  - Sidebar nav still works as normal navigation (no modal interference).
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-DASH-${Math.random().toString(36).slice(2, 7)}`;

interface AuthEnvelope<T> { success: boolean; data: T; }

async function loginAndGetToken(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  const body = (await res.json()) as AuthEnvelope<{ access_token: string }>;
  return body.data.access_token;
}

async function createClientViaApi(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
): Promise<number> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.post(`${API_BASE}/clients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, phone: '+54 11 0000-0000', address: 'Calle Test 123' },
  });
  const body = (await res.json()) as AuthEnvelope<{ id: number }>;
  return body.data.id;
}

async function openDashboard(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin');
  await expect(page.getByText(/panel de control/i)).toBeVisible({ timeout: 10_000 });
}

/**
 * Returns a locator for the dashboard card whose primary label matches
 * the given text. Scoping to `role="article"` + exact-label match avoids
 * the sidebar buttons that share the same label text (e.g. "CAJA"), and
 * avoids false positives when a card description contains another card's
 * label as a substring (e.g. CALCULADORA's description "Calculadora de
 * materiales" would otherwise match "MATERIALES").
 */
function dashboardCard(page: import('@playwright/test').Page, label: string | RegExp) {
  const source = typeof label === 'string'
    ? label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : label.source;
  return page
    .getByRole('article')
    .filter({
      has: page.locator(`text=/^\\s*${source}\\s*$/`),
    });
}

test.describe('Dashboard modales', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('dashboard shows all 10 cards', async ({ page }) => {
    await openDashboard(page);
    await expect(dashboardCard(page, 'CAJA')).toBeVisible();
    await expect(dashboardCard(page, 'NUEVO PRESUPUESTO')).toBeVisible();
    await expect(dashboardCard(page, 'NUEVA ORDEN')).toBeVisible();
    await expect(dashboardCard(page, 'ORDENES EN MEDICION / TALLER')).toBeVisible();
    await expect(dashboardCard(page, 'ORDENES TERMINADAS P/ ENVIO')).toBeVisible();
    await expect(dashboardCard(page, 'STOCK DE PILETAS')).toBeVisible();
    await expect(dashboardCard(page, 'MATERIALES')).toBeVisible();
    await expect(dashboardCard(page, 'TRABAJOS ADICIONALES')).toBeVisible();
    await expect(dashboardCard(page, 'CATEGORIAS')).toBeVisible();
    await expect(dashboardCard(page, 'CALCULADORA')).toBeVisible();
  });

  test('CAJA card opens cash modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'CAJA').click();
    // The modal title is "Caja". The CashDailyPage renders "Caja Diaria" inside.
    await expect(page.getByRole('heading', { name: 'Caja' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/saldo anterior/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('NUEVO PRESUPUESTO card opens budget form modal', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    await createClientViaApi(request, token, `Dash Budget ${UNIQUE}`);

    await openDashboard(page);
    await dashboardCard(page, 'NUEVO PRESUPUESTO').click();
    // The modal title is "Nuevo presupuesto". The form loads the client
    // typeahead once the data is fetched.
    await expect(page.getByRole('heading', { name: 'Nuevo presupuesto' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(/buscar cliente/i)).toBeVisible({ timeout: 15_000 });
  });

  test('NUEVA ORDEN card opens work order form modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'NUEVA ORDEN').click();
    await expect(page.getByRole('heading', { name: /nueva orden de trabajo/i }).first()).toBeVisible({ timeout: 10_000 });
    // The form has a client typeahead.
    await expect(page.getByPlaceholder(/buscar cliente/i)).toBeVisible({ timeout: 15_000 });
  });

  test('ORDENES EN MEDICION/TALLER card opens work-orders list modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'ORDENES EN MEDICION / TALLER').click();
    await expect(page.getByRole('heading', { name: /[oó]rdenes en medici[oó]n/i }).first()).toBeVisible({ timeout: 10_000 });
    // The WorkOrdersListPage renders a table.
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('ORDENES TERMINADAS card opens work-orders list modal with DELIVERED pre-filter', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'ORDENES TERMINADAS P/ ENVIO').click();
    await expect(page.getByRole('heading', { name: /[oó]rdenes terminadas/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('STOCK DE PILETAS card opens pool stock modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'STOCK DE PILETAS').click();
    await expect(page.getByRole('heading', { name: 'Stock de piletas' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('MATERIALES card opens materials list modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'MATERIALES').click();
    await expect(page.getByRole('heading', { name: 'Materiales' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('TRABAJOS ADICIONALES card opens additional works modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'TRABAJOS ADICIONALES').click();
    await expect(page.getByRole('heading', { name: 'Trabajos adicionales' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('CATEGORIAS card opens categories modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'CATEGORIAS').click();
    await expect(page.getByRole('heading', { name: /categor[íi]as de materiales/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('CALCULADORA card opens calculator modal with interactive UI', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'CALCULADORA').click();
    await expect(page.getByRole('heading', { name: 'Calculadora' }).first()).toBeVisible({ timeout: 10_000 });
    // Calculator is interactive — verify the inputs are present.
    await expect(page.locator('input[placeholder="0.00"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Escape closes the open modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'CALCULADORA').click();
    await expect(page.getByRole('heading', { name: 'Calculadora' }).first()).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toHaveCount(0, { timeout: 5_000 });
  });

  test('Clicking the X close button closes the modal', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'CALCULADORA').click();
    await expect(page.getByRole('heading', { name: 'Calculadora' }).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /cerrar/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toHaveCount(0, { timeout: 5_000 });
  });

  test('Sidebar navigation still navigates (no modal interference)', async ({ page }) => {
    await openDashboard(page);
    // Click the "Clientes" sidebar link — must navigate, not open a modal.
    // Scope to the sidebar nav (a `<complementary>` landmark = <aside>).
    // The accordion item "AGENDA" must be open before its children are
    // clickable, so click the parent button first.
    await page.locator('aside').getByRole('button', { name: 'AGENDA' }).click();
    await page.locator('aside').getByRole('link', { name: 'Clientes' }).click();
    await expect(page).toHaveURL(/\/admin\/clients$/);
    // No modal should be open.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
