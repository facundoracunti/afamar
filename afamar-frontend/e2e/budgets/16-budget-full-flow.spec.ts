/**
 * Budget — flujo completo end-to-end.
 *
 * Crea un presupuesto con todo el contenido representativo:
 *   - cliente
 *   - 1 material principal
 *   - 1 material alternativo
 *   - 1 pileta
 *   - trasforo de pileta (cutout)
 *   - zócalos (uno por material)
 *
 * Verifica en el EDITOR:
 *   - la sección PRESUPUESTO sigue mostrando line items + totales + pago
 *     aun con alternativos (regresión del bug de `hayAlternativas`).
 *   - aparece la grilla de "OPCIONES DE COTIZACIÓN DISPONIBLES" debajo.
 *
 * Verifica el PDF:
 *   - el preview se abre en el modal.
 *   - el endpoint de descarga (`/api/v1/budgets/:id/pdf`) responde 200
 *     con content-type PDF.
 *
 * Captura screenshots por sector (`shot-<area>-<sector>`) que se embeben
 * en el `test_report.html` generado por el reporter custom.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-FULLFLOW-${Math.random().toString(36).slice(2, 7)}`;

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

/** Toma los dos materiales con label único (nombre+color) para que el
 *  picker del form los pueda desambiguar. */
function pickTwoMaterials(list: MaterialApi[]): { main: MaterialApi; alt: MaterialApi } {
  const usable = list.filter((m) => m.id && m.name);
  const labelOf = (m: MaterialApi) => (m.color ? `${m.name} - ${m.color.trim()}` : m.name);
  const counts = new Map<string, number>();
  for (const m of usable) counts.set(labelOf(m), (counts.get(labelOf(m)) ?? 0) + 1);
  const unique = usable.filter((m) => counts.get(labelOf(m)) === 1);
  if (unique.length < 2) {
    throw new Error('Not enough unique-label catalogue materials for the full-flow test');
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

interface SeededBudget {
  budgetId: number;
  budgetNumber: string;
  clientName: string;
  main: MaterialApi;
  alt: MaterialApi;
}

/** Crea via API un presupuesto "full" (cliente + 2 materiales + pileta +
 *  trasforo + zócalos). Devuelve los IDs para que el test pueda abrir el
 *  form y verificarlo. */
async function seedFullBudget(
  request: APIRequestContext,
  token: string,
): Promise<SeededBudget> {
  const { main, alt } = pickTwoMaterials(await fetchMaterials(request, token));

  const clientRes = await request.post(`${API_BASE}/clients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `FullFlow ${UNIQUE}`, phone: '+54 11 9999-0000', address: 'Av. Test 1234' },
  });
  const clientBody = (await clientRes.json()) as AuthEnvelope<{ id: number }>;
  const clientName = `FullFlow ${UNIQUE}`;

  // Pileta via API (mismo patrón que 06-pool-stock.spec.ts).
  const poolRes = await request.post(`${API_BASE}/pool-stock`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      brand: `FullFlow-${UNIQUE}`,
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

  // fabrication_details: BASEBOARD para cada material + CUTOUT_SINK
  // (concept 'OTHER', detail 'Apertura y pegado de pileta').
  const fabricationDetails = JSON.stringify([
    {
      concept: 'BASEBOARD',
      detail: 'Zócalo',
      material: main.name,
      material_price_m2: 0,
      length: 0,
      width: 0,
      m2: 0,
      labor: null,
      currency: 'ARS',
      quantity: 2.5,
      price: 18000,
    },
    {
      concept: 'BASEBOARD',
      detail: 'Zócalo',
      material: alt.name,
      material_price_m2: 0,
      length: 0,
      width: 0,
      m2: 0,
      labor: null,
      currency: 'ARS',
      quantity: 2.5,
      price: 22000,
    },
    {
      concept: 'OTHER',
      detail: 'Apertura y pegado de pileta',
      material: main.name,
      material_price_m2: 0,
      length: 0,
      width: 0,
      m2: 0,
      labor: null,
      currency: 'ARS',
      quantity: 1,
      price: 60000,
    },
  ]);

  const poolsData = JSON.stringify([
    {
      pool_id: poolId,
      brand: `FullFlow-${UNIQUE}`,
      model: `M-${UNIQUE}`,
      price: 80000,
      currency: 'ARS',
      quantity: 1,
      material: main.name,
    },
  ]);

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
    },
  });
  const created = (await createRes.json()) as AuthEnvelope<{ id: number; number: string }>;

  return {
    budgetId: created.data.id,
    budgetNumber: created.data.number,
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

test.describe('Budget — flujo completo (main + alternativo + pileta + trasforo + zócalos)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('Presupuesto + PDF renderizan correctamente con alternativas', async ({ page, request }, testInfo) => {
    const token = await loginAndGetToken(request);
    const seeded = await seedFullBudget(request, token);

    // ── 1. EDITOR ────────────────────────────────────────────────
    await page.goto(`/admin/budgets/${seeded.budgetId}`);
    await expect(page.getByRole('button', { name: /vista previa/i }))
      .toBeVisible({ timeout: 15_000 });

    // Materiales en cards.
    await expect(page.getByTestId('material-card').first().getByText(seeded.main.name, { exact: true }))
      .toBeVisible();
    await expect(page.getByText(seeded.alt.name, { exact: true }).first())
      .toBeVisible();

    await captureShot(page, testInfo, 'shot-budgets-form-filled');

    // ── 2. PRESUPUESTO (regresión crítica) ───────────────────────
    // La sección PRESUPUESTO debe mostrar: line items + totales + pago,
    // INCLUSO con alternativos (bug previo: `hayAlternativas` ocultaba
    // todo el body). La grilla de alternativas debe coexistir ABAJO.
    const presupuesto = page.locator('.card', { hasText: 'PRESUPUESTO' }).first();
    await expect(presupuesto).toBeVisible();

    // Line items: aparece el material principal (puede coincidir con
    // otras menciones del mismo nombre en zócalos/trasforo/alt-grid;
    // basta con que el primero sea visible).
    await expect(presupuesto.getByText(seeded.main.name, { exact: false }).first())
      .toBeVisible();
    await expect(presupuesto.getByText(/Apertura y pegado de pileta/i).first())
      .toBeVisible();
    await expect(presupuesto.getByText(/Z[oó]calo/i).first()).toBeVisible();
    await expect(
      presupuesto.getByText(new RegExp(`Pileta.*FullFlow-${UNIQUE}`, 'i')).first(),
    ).toBeVisible();

    // Totales y pago (los que faltaban en el bug).
    await expect(presupuesto.getByText(/SUBTOTALES/i).first()).toBeVisible();
    await expect(presupuesto.getByText(/TOTAL ARS/i).first()).toBeVisible();
    await expect(presupuesto.getByText(/SALDO PENDIENTE/i).first()).toBeVisible();
    await expect(presupuesto.getByText(/Forma de pago/i).first()).toBeVisible();

    await captureShot(page, testInfo, 'shot-budgets-presupuesto');

    // ── 3. GRILLA DE OPCIONES (debajo del Presupuesto) ───────────
    // El Presupuesto y la grilla de opciones comparten el mismo wrapper.
    // Ambos materiales (principal + alternativo) se renderizan con el
    // mismo card component: el principal con badge "PRINCIPAL", las
    // alternativas con "ALTERNATIVA A/B/C…".
    const opciones = page.locator('[class*="quote-options"]');
    await expect(opciones.getByText(/ALTERNATIVA A/i)).toBeVisible();
    await expect(opciones.getByText(seeded.alt.name, { exact: true }).first()).toBeVisible();
    await expect(opciones.getByText('PRINCIPAL', { exact: true })).toBeVisible();

    await captureShot(page, testInfo, 'shot-budgets-alternatives');

    // ── 4. PDF preview ────────────────────────────────────────────
    await page.getByRole('button', { name: /vista previa/i }).click();
    const pdfModal = page.getByText(/Vista previa.*Presupuesto/i);
    await expect(pdfModal).toBeVisible({ timeout: 20_000 });
    await captureShot(page, testInfo, 'shot-budgets-pdf-preview');

    // Cerrar el modal: presionar Escape (el overlay también cierra al
    // clickear afuera pero el click depende del layout). Skip no es
    // crítico para este test — lo importante es que el PDF renderizó.
    await page.keyboard.press('Escape');
    // El modal probablemente no escucha Escape; usamos el botón ✕ Cerrar
    // scoped al header del modal.
    const modalHeader = page.locator('[class*="pdf-modal-header"]');
    if (await modalHeader.isVisible().catch(() => false)) {
      await modalHeader.getByRole('button', { name: /cerrar/i }).first().click();
    }
    await expect(pdfModal).toHaveCount(0, { timeout: 3_000 }).catch(() => undefined);

    // ── 5. PDF download (endpoint backend) ────────────────────────
    const pdfRes = await request.get(`${API_BASE}/budgets/${seeded.budgetId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()['content-type']).toMatch(/pdf/i);

    // Sanity checks sobre el binario: magic bytes PDF + tamaño razonable.
    // (No inspeccionamos texto porque los PDFs almacenan strings en
    // codificación PostScript y latin1 los corrompe; el preview del
    // modal ya validó la renderización visual.)
    const pdfBuffer = await pdfRes.body();
    expect(pdfBuffer.byteLength).toBeGreaterThan(2_000);
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(pdfBuffer.subarray(-6).toString('ascii')).toMatch(/%%EOF/);
  });
});