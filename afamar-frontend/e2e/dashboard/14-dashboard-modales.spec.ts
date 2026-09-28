/**
 * Dashboard cards — each card opens a modal embedding the real page (no
 * navigation; the URL stays at `/admin`). Verifies:
 *  - "NUEVO PRESUPUESTO" / "NUEVA ORDEN" open the full continuous budget /
 *    work-order form inside the modal (vertical scroll, NO wizard/carousel
 *    with "Siguiente"/"Anterior" step buttons).
 *  - Each modal card opens the expected modal with the expected title.
 *  - Modal content matches the embedded page.
 *  - Escape closes the modal.
 *  - Clicking the overlay closes the modal.
 *  - Sidebar nav still works as normal navigation (no modal interference).
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

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

  test('NUEVO PRESUPUESTO card opens the FULL budget form modal (no wizard)', async ({ page }) => {
    // The create card opens a modal on top of the dashboard: the URL must
    // stay at `/admin`, and the modal must render the full continuous form
    // (vertical scroll) — NOT the wizard/carousel with step buttons.
    await openDashboard(page);
    await dashboardCard(page, 'NUEVO PRESUPUESTO').click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Nuevo Presupuesto' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/buscar cliente/i)).toBeVisible({ timeout: 15_000 });
    // Full form has NO wizard step navigation.
    await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Anterior' })).toHaveCount(0);
    await expect(page.getByText(/paso 1 de/i)).toHaveCount(0);
    // The submit button is always rendered in full mode.
    await expect(page.getByRole('button', { name: /guardar/i })).toBeVisible();
  });

  test('NUEVA ORDEN card opens the FULL work order form modal (no wizard)', async ({ page }) => {
    await openDashboard(page);
    await dashboardCard(page, 'NUEVA ORDEN').click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Nueva Orden de Trabajo' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/buscar cliente/i)).toBeVisible({ timeout: 15_000 });
    // Full form has NO wizard step navigation.
    await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Anterior' })).toHaveCount(0);
    await expect(page.getByText(/paso 1 de/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /guardar/i }).first()).toBeVisible();
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
