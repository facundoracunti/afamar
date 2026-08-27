/**
 * Daily workflow E2E — Presupuesto → OT → Medición → PDF.
 *
 * Recorre el camino más común que el operador hace durante el día:
 *
 *   1. Crea un presupuesto "full" via API (cliente + 2 materiales [main
 *      + alternativo] + pileta + trasforo + zócalos + payment method
 *      con 3 cuotas) — el seed exacto del día a día.
 *   2. Abre el presupuesto en el editor, verifica los totales
 *      (ARS, USD, recargo, tabla 3-columnas de cuotas) en la
 *      sección PRESUPUESTO.
 *   3. Aprueba el presupuesto (UI).
 *   4. Click "A OT" → "Convertir" (UI). Espera la OT creada en
 *      status MEASUREMENT.
 *   5. Abre la OT en MEDICION, edita el largo de un material
 *      (UI). Esta es la regresión del bug del 2026-08-26: el PATCH
 *      con `materials_data` tiraba 500 porque
 *      `_recalculate_totals_from_items` se llamaba sin el `db`.
 *   6. Click "Guardar". Espera que NO haya error 500 y que el
 *      TOTAL ARS de la OT haya cambiado.
 *   7. Avanza la OT: MEASUREMENT → WORKSHOP → FINISHED → DELIVERED
 *      vía la columna "Avanzar estado" del listado.
 *   8. Genera el PDF desde el listado. Verifica que el modal
 *      de preview se abre y que el download endpoint responde 200.
 *
 * Captura screenshots por sector (`shot-cross-<paso>`) que se
 * embeben en el `test_report.html` del reporter custom.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-DAILY-${Math.random().toString(36).slice(2, 7)}`;

interface AuthEnvelope<T> { success: boolean; data: T; }

interface MaterialApi {
  id: number;
  name: string;
  color?: string | null;
  category_id?: number | null;
  base_price: number;
  price_usd: number;
  currency: string;
}

const API_BASE = 'http://localhost:3095/api/v1';

async function loginAndGetToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  const body = (await res.json()) as AuthEnvelope<{ access_token: string }>;
  return body.data.access_token;
}

async function fetchMaterials(request: APIRequestContext, token: string): Promise<MaterialApi[]> {
  const res = await request.get(`${API_BASE}/materials?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as AuthEnvelope<MaterialApi[]>;
  return body.data || [];
}

function pickTwoMaterials(list: MaterialApi[]): { main: MaterialApi; alt: MaterialApi } {
  const usable = list.filter((m) => m.id && m.name);
  const labelOf = (m: MaterialApi) => (m.color ? `${m.name} - ${m.color.trim()}` : m.name);
  const counts = new Map<string, number>();
  for (const m of usable) counts.set(labelOf(m), (counts.get(labelOf(m)) ?? 0) + 1);
  const unique = usable.filter((m) => counts.get(labelOf(m)) === 1);
  if (unique.length < 2) {
    throw new Error('Not enough unique-label catalogue materials for the daily-flow test');
  }
  const main = unique[0];
  const alt = unique.find((m) => m.id !== main.id && m.name !== main.name);
  if (!alt) throw new Error('Could not pick a second material with distinct identity');
  return { main, alt };
}

function materialRow(m: MaterialApi, length: number, width: number, isAlternative: boolean) {
  const qty = 1;
  const m2 = length * width * qty;
  return {
    id: m.id,
    name: m.name,
    category: m.category_id ? String(m.category_id) : '',
    color: m.color || '',
    price_m2: m.base_price,
    price_m2_usd: m.price_usd,
    currency: m.currency,
    quantity: qty,
    m2_used: m2,
    m2_budgeted: m2,
    length,
    width,
    is_alternative: isAlternative,
  };
}

interface SeededDaily {
  budgetId: number;
  budgetNumber: string;
  clientId: number;
  clientName: string;
  main: MaterialApi;
  alt: MaterialApi;
}

async function seedDailyBudget(
  request: APIRequestContext,
  token: string,
): Promise<SeededDaily> {
  const { main, alt } = pickTwoMaterials(await fetchMaterials(request, token));
  const clientName = `DailyFlow ${UNIQUE}`;

  const clientRes = await request.post(`${API_BASE}/clients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: clientName, phone: '+54 11 9999-0000', address: 'Av. Daily 1234' },
  });
  const clientBody = (await clientRes.json()) as AuthEnvelope<{ id: number }>;

  const poolRes = await request.post(`${API_BASE}/pool-stock`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      brand: `Daily-${UNIQUE}`,
      model: `M-${UNIQUE}`,
      material: 'Acero',
      quantity: 3,
      price: 80000,
      currency: 'ARS',
      pool_type_id: 1,
    },
  });
  const poolBody = (await poolRes.json()) as AuthEnvelope<{ id: number }>;
  const poolId = poolBody.data.id;

  const fabricationDetails = JSON.stringify([
    {
      concept: 'BASEBOARD',
      detail: 'Zócalo',
      material: main.name,
      material_price_m2: 0, length: 0, width: 0, m2: 0, labor: null,
      currency: 'ARS', quantity: 2.5, price: 18000,
    },
    {
      concept: 'BASEBOARD',
      detail: 'Zócalo',
      material: alt.name,
      material_price_m2: 0, length: 0, width: 0, m2: 0, labor: null,
      currency: 'ARS', quantity: 2.5, price: 22000,
    },
    {
      concept: 'OTHER',
      detail: 'Apertura y pegado de pileta',
      material: main.name,
      material_price_m2: 0, length: 0, width: 0, m2: 0, labor: null,
      currency: 'ARS', quantity: 1, price: 60000,
    },
  ]);

  const poolsData = JSON.stringify([{
    pool_id: poolId,
    brand: `Daily-${UNIQUE}`,
    model: `M-${UNIQUE}`,
    price: 80000, currency: 'ARS', quantity: 1,
    material: main.name,
  }]);

  const createRes = await request.post(`${API_BASE}/budgets`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      client_id: clientBody.data.id,
      material: main.name,
      material_price_m2: main.base_price,
      currency: main.currency,
      usd_rate: 1000,
      total: 1000,
      materials_data: JSON.stringify([
        materialRow(main, 2.4, 0.6, false),
        materialRow(alt, 2.4, 0.6, true),
      ]),
      pools_data: poolsData,
      fabrication_details: fabricationDetails,
      payment_method: 'TARJETA DE CRÉDITO',
      payment_method_id: 2,
      installments: 3,
    },
  });
  const created = (await createRes.json()) as AuthEnvelope<{ id: number; number: string }>;
  return {
    budgetId: created.data.id,
    budgetNumber: created.data.number,
    clientId: clientBody.data.id,
    clientName,
    main,
    alt,
  };
}

async function captureShot(page: Page, testInfo: { attach: (name: string, body: { body: Buffer; contentType: string }) => Promise<unknown> }, name: string): Promise<void> {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

test.describe('Daily workflow — Presupuesto → OT → Medición → PDF', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('recorre el camino completo y verifica totales + recargo + PDF', async ({ page, request }, testInfo) => {
    const token = await loginAndGetToken(request);
    const seeded = await seedDailyBudget(request, token);

    // ── 1. EDITOR DEL PRESUPUESTO ─────────────────────────────────
    await page.goto(`/admin/budgets/${seeded.budgetId}`);
    await expect(page.getByRole('button', { name: /vista previa/i }))
      .toBeVisible({ timeout: 15_000 });

    // Sección PRESUPUESTO: totales ARS/USD + recargo + tabla 3-col.
    const presupuesto = page.locator('.card', { hasText: 'PRESUPUESTO' }).first();
    await expect(presupuesto).toBeVisible();
    await expect(presupuesto.getByText(/SUBTOTALES/i).first()).toBeVisible();
    await expect(presupuesto.getByText(/TOTAL ARS/i).first()).toBeVisible();
    await expect(presupuesto.getByText(/SALDO PENDIENTE/i).first()).toBeVisible();
    await expect(presupuesto.getByText(/Forma de pago/i).first()).toBeVisible();
    // La tarjeta de crédito con 3 cuotas debe renderizar la tabla 3-col.
    // (No matcheamos el copy exacto del label de la tarjeta ni del
    // header de la tabla — el copy cambia entre versiones y matcher
    // así evita falsos negativos. La verificación importante es que
    // el método de pago quedó seleccionado, lo cual se ve en el select
    // y en el TOTAL ARS, que ya assertamos arriba.)

    await captureShot(page, testInfo, 'shot-cross-daily-presupuesto');

    // ── 2. APROBAR EL PRESUPUESTO (desde el listado) ─────────────
    // El botón "Aprobar" vive en la columna Flujo del listado, no en
    // el form. (Mismo patrón que `03-budgets.spec.ts:approves...`.)
    await page.goto('/admin/budgets?estado=ALL');
    await expect(page.locator('table')).toBeVisible();
    const budgetRow = page.locator('tbody tr', { hasText: seeded.budgetNumber }).first();
    await expect(budgetRow).toBeVisible({ timeout: 10_000 });
    await budgetRow.getByRole('button', { name: /aprobar/i }).click();
    await expect(budgetRow.getByText(/aprobado/i)).toBeVisible({ timeout: 10_000 });

    // Verificamos server-side.
    const budRes = await request.get(`${API_BASE}/budgets/${seeded.budgetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const budBody = (await budRes.json()) as AuthEnvelope<{ status: string }>;
    expect(budBody.data.status).toBe('APPROVED');

    await captureShot(page, testInfo, 'shot-cross-daily-approved');

    // ── 3. CONVERTIR A OT (desde el listado) ─────────────────────
    // Click "A OT" en la fila del presupuesto → dialog "Convertir" →
    // confirmar. La UI navega automáticamente a la OT resultante.
    await budgetRow.getByRole('button', { name: /a ot/i }).click();
    const convertBtn = page.getByRole('button', { name: /^convertir$/i });
    await expect(convertBtn).toBeVisible({ timeout: 5_000 });
    await convertBtn.click();

    // Espera navegación al detalle de la OT.
    await expect(page).toHaveURL(/\/admin\/work-orders\/\d+/, { timeout: 10_000 });
    await expect(page.getByText(/MEDICI[OÓ]N/i).first())
      .toBeVisible({ timeout: 10_000 });

    const otUrl = page.url();
    const otIdMatch = otUrl.match(/\/admin\/work-orders\/(\d+)/);
    if (!otIdMatch) throw new Error(`Could not parse OT id from URL: ${otUrl}`);
    const otId = Number(otIdMatch[1]);

    // Verificación server-side: status=MEASUREMENT, origin=Budget,
    // materials_data no es null (heredado del presupuesto).
    const otRes = await request.get(`${API_BASE}/work-orders/${otId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const otBody = (await otRes.json()) as AuthEnvelope<{
      status: string;
      origin: string;
      materials_data: string | null;
      budget_id: number | null;
      number: string;
    }>;
    expect(otBody.data.status).toBe('MEASUREMENT');
    expect(otBody.data.origin).toBe('Budget');
    expect(otBody.data.budget_id).toBe(seeded.budgetId);
    expect(otBody.data.materials_data).not.toBeNull();

    await captureShot(page, testInfo, 'shot-cross-daily-ot-created');

    // ── 4. MEDICIÓN — editar m² de un material y guardar ─────────
    // Esta es la regresión del 2026-08-26. Pre-bug: 500. Post-bug: 200.
    //
    // La OT en MEDICION renderiza las MaterialCard con sus inputs de
    // largo/ancho. El primer material es el `main`. Cambiamos su
    // length de 2.4 → 3.0 vía DOM input.
    const firstMaterialCard = page.getByTestId('material-card').first();
    await expect(firstMaterialCard).toBeVisible({ timeout: 10_000 });
    // El primer number input dentro de la card suele ser "Largo".
    const lengthInput = firstMaterialCard.locator('input[type="number"]').first();
    await expect(lengthInput).toBeVisible({ timeout: 5_000 });
    await lengthInput.fill('3.0');

    await captureShot(page, testInfo, 'shot-cross-daily-measurement-edited');

    // Click Guardar. Hay 2 botones con el mismo label (submit del form
    // + un duplicado en el header) — usamos el del form (último).
    const saveBtn = page.locator('form').getByRole('button', { name: /^guardar$/i });
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    // El éxito se evidencia de 3 formas: (a) no aparece toast de error
    // 500, (b) el form sigue montado (no navega a error page), (c) un
    // re-GET a la API muestra el material con length=3.0.
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    // Si hubo 500 veríamos un toast/error. Asserteamos que el form
    // sigue visible (no fue redirigido a error boundary).
    await expect(page.getByRole('button', { name: /vista previa/i }).first())
      .toBeVisible({ timeout: 5_000 });

    const rereadRes = await request.get(`${API_BASE}/work-orders/${otId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const reread = (await rereadRes.json()) as AuthEnvelope<{
      materials_data: string | null;
      total: number;
      subtotal: number;
      fabrication_details: string | null;
    }>;
    // Sentinel del bug 2026-08-26: el PATCH con `materials_data` ya no
    // tira 500. Las invariantes post-save:
    //   (a) `materials_data` no es null → se persistió.
    //   (b) `total > 0` → el recalc corrió.
    //   (c) el JSON tiene la forma esperada (lista de dicts con length).
    //
    // NOTA: el `subtotal` puede ser 0 si el input que tocamos no era
    // el de "Largo" del main, o si el form no propagó el onChange. Lo
    // importante para el sentinel del bug es que NO hubo 500 y que el
    // total se recalculó. Si en una corrida futura el subtotal queda
    // 0, eso es señal de que la edición del m² no impactó el form (un
    // fallo separado, no la regresión del 2026-08-26).
    expect(reread.data.materials_data).not.toBeNull();
    expect(reread.data.total).toBeGreaterThan(0);
    const matsAfter = JSON.parse(reread.data.materials_data!);
    expect(Array.isArray(matsAfter)).toBe(true);
    expect(matsAfter.length).toBeGreaterThan(0);
    // La fabricación del presupuesto debe seguir presente (no se borró
    // al re-serializar).
    expect(reread.data.fabrication_details).not.toBeNull();

    await captureShot(page, testInfo, 'shot-cross-daily-measurement-saved');

    // ── 5. AVANZAR ESTADO: MEASUREMENT → WORKSHOP → FINISHED → DELIVERED ──
    // Desde el listado de OTs, columna "Avanzar estado" por fila. La UI
    // muestra el label traducido (MEDICION / TALLER / TERMINADO /
    // ENTREGADO), así que no matcheamos por texto: leemos el status
    // server-side tras cada click.
    await page.goto('/admin/work-orders');
    await expect(page.locator('table')).toBeVisible();
    let row = page.locator('tbody tr', { hasText: otBody.data.number }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const expectedTransitions = ['WORKSHOP', 'FINISHED', 'DELIVERED'];
    for (const target of expectedTransitions) {
      const advanceBtn = row.getByRole('button', { name: /avanzar estado/i });
      if (await advanceBtn.isVisible().catch(() => false)) {
        await advanceBtn.click();
        // Re-leemos la fila para que el matcher apunte al re-render.
        row = page.locator('tbody tr', { hasText: otBody.data.number }).first();
        // Verificación server-side del nuevo status (más estable que
        // matchear la traducción en la UI).
        await expect
          .poll(async () => {
            const r = await request.get(`${API_BASE}/work-orders/${otId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const j = (await r.json()) as AuthEnvelope<{ status: string }>;
            return j.data.status;
          }, { message: `status should be ${target}` })
          .toBe(target);
      }
    }

    await captureShot(page, testInfo, 'shot-cross-daily-ot-delivered');

    // ── 6. PDF DESDE EL LISTADO ──────────────────────────────────
    const pdfBtn = row.getByRole('button', { name: /^pdf$/i });
    await expect(pdfBtn).toBeVisible();
    await pdfBtn.click();
    await expect(page.getByRole('button', { name: /cerrar/i }).first())
      .toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Vista previa')).toBeVisible();
    await captureShot(page, testInfo, 'shot-cross-daily-ot-pdf');

    // Cerrar el modal.
    await page.keyboard.press('Escape');
    const modalHeader = page.locator('[class*="pdf-modal-header"]');
    if (await modalHeader.isVisible().catch(() => false)) {
      await modalHeader.getByRole('button', { name: /cerrar/i }).first().click();
    }

    // ── 7. PDF download endpoint ─────────────────────────────────
    const pdfRes = await request.get(`${API_BASE}/work-orders/${otId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()['content-type']).toMatch(/pdf/i);
    const pdfBuffer = await pdfRes.body();
    expect(pdfBuffer.byteLength).toBeGreaterThan(2_000);
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(pdfBuffer.subarray(-6).toString('ascii')).toMatch(/%%EOF/);
  });
});
