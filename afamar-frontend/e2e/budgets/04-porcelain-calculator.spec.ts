/**
 * Porcelain calculator — embedded in the budget form.
 *
 * Two flows:
 *  - `full mode` (form pages): la calculadora vive en la zona inferior
 *    junto al croquis, colapsada por defecto.
 *  - `wizard mode` (dashboard modal "NUEVO PRESUPUESTO"): tiene un paso
 *    dedicado y arranca abierta para que el primer plano sea la calculadora.
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

test.describe('Porcelain calculator (budget form)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('full mode: calcula zócalos, agrega el ítem de corte y lo muestra en Fabricación', async ({ page }) => {
    await page.goto('/admin/budgets/new');

    // The form loads materials/pools/clients before becoming interactive.
    await expect(page.getByRole('button', { name: /vista previa/i })).toBeVisible({ timeout: 15_000 });

    // La sección vive en el bottom, colapsada por defecto: hay que activarla.
    await page.getByRole('button', { name: /activar calculadora de porcelanato/i }).click();

    // Datos: 1.20 × 0.60 m, 2 cajas × 4 piezas, zócalo 10 cm, disco 3 mm (default), $5.000/ML.
    await page.getByLabel('Largo porcelanato (m)').fill('1.2');
    await page.getByLabel('Ancho porcelanato (m)').fill('0.6');
    await page.getByLabel('Cantidad de cajas').fill('2');
    await page.getByLabel('Piezas por caja').fill('4');
    await page.getByLabel('Altura solicitada zócalo (m)').fill('0.1');
    await page.getByLabel(/precio por ml/i).fill('5000');

    await page.getByRole('button', { name: /^calcular$/i }).click();

    // 600 mm placa, 100 mm zócalo, 3 mm disco → 5 cortes/placa (no 6).
    // 8 placas × 5 = 40 cortes × 1.2 m = 48 ML × $5.000 = $ 240.000.
    await expect(page.getByText('$ 240.000,00').first()).toBeVisible();
    await expect(page.getByText(/altura final aproximada del zócalo: 9\.7 cm/i)).toBeVisible();

    await page.getByRole('button', { name: /agregar al presupuesto/i }).click();
    await expect(page.getByText('✓ Ítem agregado')).toBeVisible();

    // La fila aparece en Materiales Adicionales con el detalle y el subtotal.
    await expect(page.getByText('MATERIALES ADICIONALES')).toBeVisible();
    await expect(
      page.locator('input[value="120x60 · 8 placas · Altura solicitada 10 cm · Producción 48.00 ML"]'),
    ).toBeVisible();
    await expect(page.getByText('Subtotal: $ 240.000,00')).toBeVisible();
  });

  test('wizard mode: la calculadora es un paso dedicado, abierto por defecto', async ({ page }) => {
    // Abrimos el form en modo wizard desde el dashboard (card "NUEVO PRESUPUESTO").
    await page.goto('/admin');
    await page.locator('article').filter({ hasText: /nuevo presupuesto/i }).first().click();

    // El wizard arranca con el paso Cliente. Avanzamos hasta "Calculadora de porcelanato".
    const calcStep = page.getByRole('button', { name: /calculadora de porcelanato/i });
    await expect(calcStep).toBeVisible({ timeout: 15_000 });

    // El panel está en su propio paso: navegamos con Siguiente y verificamos
    // que el primer plano ya sea la calculadora operativa (no el toggle).
    await calcStep.click();
    await expect(page.getByRole('heading', { name: /calculadora de porcelanato/i })).toBeVisible();

    // Sin tocar nada: el input de Largo debe estar visible y habilitado.
    await expect(page.getByLabel('Largo porcelanato (m)')).toBeVisible();

    // Tampoco se muestra el botón toggle "Activar..." cuando defaultOpen=true.
    await expect(page.getByRole('button', { name: /activar calculadora de porcelanato/i })).toHaveCount(0);

    // Y el botón Ocultar sí está disponible por si quieren plegarlo.
    await expect(page.getByRole('button', { name: /ocultar calculadora de porcelanato/i })).toBeVisible();
  });
});
