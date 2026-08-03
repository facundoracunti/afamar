/**
 * Smoke tests: each sidebar route loads and shows its expected page title.
 *
 * The topbar's page title (`<div class="...page-title">{title}</div>`) is
 * the canonical "this page loaded" signal — it always renders once the
 * MainLayout mounts, before the page's own data fetch completes. We assert
 * on the text content directly, since CSS module class names are
 * transformed at build time.
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const ROUTES: { path: string; title: string }[] = [
  { path: '/admin', title: 'Panel Principal' },
  { path: '/admin/clients', title: 'Clientes' },
  { path: '/admin/budgets', title: 'Presupuestos' },
  { path: '/admin/work-orders', title: 'Órdenes de Trabajo' },
  { path: '/admin/materials', title: 'Materiales' },
  { path: '/admin/materials/categories', title: 'Categorías de Materiales' },
  { path: '/admin/pool-stock', title: 'Stock de Piletas' },
  { path: '/admin/additional-works', title: 'Trabajos Adicionales' },
  { path: '/admin/measurements', title: 'Mediciones' },
  { path: '/admin/plate-calculator', title: 'Calculadora de Placa' },
  { path: '/admin/porcelain-tile-calculator', title: 'Calculadora de Porcelanato' },
  { path: '/admin/cash', title: 'Caja Diaria' },
  { path: '/admin/cash/history', title: 'Historial de Caja' },
  { path: '/admin/reports', title: 'Reportes' },
  { path: '/admin/configuration', title: 'Configuración' },
  { path: '/admin/product-photos', title: 'Fotos de Productos' },
];

test.describe('Smoke — sidebar routes', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  for (const { path, title } of ROUTES) {
    test(`${path} loads with title "${title}"`, async ({ page }) => {
      await page.goto(path);
      // The title is rendered as plain text inside a div. Use exact match
      // and `.first()` to skip the sidebar duplicate.
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    });
  }
});
