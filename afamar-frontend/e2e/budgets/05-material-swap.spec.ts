/**
 * Material swap ("Cambiar material") — replaces a card's catalogue identity
 * without losing the measurements already entered.
 *
 * Creates a budget via the API with TWO rows of the same material (one card,
 * two measurement panes) marked as "Alternativa", then swaps the card to a
 * second catalogue material through the UI and verifies:
 *  - both rows keep their measurements (Cant./Largo/Ancho),
 *  - the "Alternativa" flag survives the swap,
 *  - the card title shows the new material,
 *  - saving round-trips the swap to the backend (`materials_data`).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-SWAP-${Math.random().toString(36).slice(2, 7)}`;

interface AuthEnvelope<T> {
  success: boolean;
  data: T;
}

interface MaterialApi {
  id: number;
  name: string;
  color?: string | null;
  category_id?: number | null;
  base_price: number;
  price_usd: number;
  currency: string;
}

interface MaterialRowApi {
  id?: number | null;
  name: string;
  quantity: number;
  length: number;
  width: number;
  is_alternative: boolean;
}

async function loginAndGetToken(request: APIRequestContext): Promise<string> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  const body = (await res.json()) as AuthEnvelope<{ access_token: string }>;
  return body.data.access_token;
}

async function fetchMaterials(
  request: APIRequestContext,
  token: string,
): Promise<MaterialApi[]> {
  const API_BASE = 'http://localhost:3095/api/v1';
  const res = await request.get(`${API_BASE}/materials?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as AuthEnvelope<MaterialApi[]>;
  return body.data || [];
}

function materialLabel(m: MaterialApi): string {
  return m.color ? `${m.name} - ${m.color.trim()}` : m.name;
}

/** Pick two distinct catalogue materials whose picker labels are unique, so
 *  `selectOption({ label })` resolves unambiguously. */
function pickTwoMaterials(list: MaterialApi[]): { matA: MaterialApi; matB: MaterialApi } {
  const usable = list.filter((m) => m.id && m.name);
  const labels = usable.map(materialLabel);
  const unique = usable.filter((m) => labels.filter((l) => l === materialLabel(m)).length === 1);
  if (unique.length < 2) {
    throw new Error('Not enough catalogue materials to test the swap picker');
  }
  const matA = unique[0];
  const matB = unique.find((m) => m.id !== matA.id && m.name !== matA.name)!;
  return { matA, matB };
}

function materialRow(m: MaterialApi, quantity: number, length: number, width: number) {
  const m2 = length * width * quantity;
  return {
    id: m.id,
    name: m.name,
    category: m.category_id ? String(m.category_id) : '',
    color: m.color || '',
    price_m2: m.base_price,
    price_m2_usd: m.price_usd,
    currency: m.currency,
    quantity,
    m2_used: m2,
    m2_budgeted: m2,
    length,
    width,
    is_alternative: true,
  };
}

test.describe('Material swap (Cambiar material)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('swaps a card\'s material keeping measurements and the alternative flag', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const { matA, matB } = pickTwoMaterials(await fetchMaterials(request, token));

    const API_BASE = 'http://localhost:3095/api/v1';
    const clientRes = await request.post(`${API_BASE}/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Swap Client ${UNIQUE}`, phone: '+54 11 0000-0000', address: 'Calle Test 123' },
    });
    const clientBody = (await clientRes.json()) as AuthEnvelope<{ id: number }>;

    const createRes = await request.post(`${API_BASE}/budgets`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        client_id: clientBody.data.id,
        material: matA.name,
        material_price_m2: matA.base_price,
        currency: matA.currency,
        usd_rate: 1000,
        total: 1000,
        materials_data: JSON.stringify([
          materialRow(matA, 3, 2, 0.5),
          materialRow(matA, 1, 1.5, 0.6),
        ]),
      },
    });
    const created = (await createRes.json()) as AuthEnvelope<{ id: number }>;
    const budgetId = created.data.id;

    await page.goto(`/admin/budgets/${budgetId}`);
    await expect(page.getByRole('button', { name: /vista previa/i })).toBeVisible({ timeout: 15_000 });

    const card = page.getByTestId('material-card').first();
    await expect(card.getByText(matA.name, { exact: true })).toBeVisible();

    // Measurement inputs (per row: Cant. → Largo → Ancho).
    const inputs = card.locator('input[type="number"]');
    await expect(card.getByLabel('Alternativa')).toBeChecked();
    await expect(inputs.nth(0)).toHaveValue('3');
    await expect(inputs.nth(1)).toHaveValue('2');
    await expect(inputs.nth(2)).toHaveValue('0.5');
    await expect(inputs.nth(3)).toHaveValue('1');
    await expect(inputs.nth(4)).toHaveValue('1.5');
    await expect(inputs.nth(5)).toHaveValue('0.6');

    // Open the "Cambiar material" picker and pick the second material.
    await card.getByRole('button', { name: /cambiar material/i }).click();
    const pickerSelect = card.locator('select', {
      has: page.getByRole('option', { name: 'Elegir material…' }),
    });
    await expect(pickerSelect).toBeVisible();
    await pickerSelect.selectOption({ label: materialLabel(matB) });

    // The panel closes and the card now shows the new material identity.
    await expect(pickerSelect).toHaveCount(0);
    await expect(card.getByText(matB.name, { exact: true })).toBeVisible();
    await expect(card.getByText(matA.name, { exact: true })).toHaveCount(0);

    // Measurements + alternative flag survived the swap.
    await expect(card.getByLabel('Alternativa')).toBeChecked();
    await expect(inputs.nth(0)).toHaveValue('3');
    await expect(inputs.nth(1)).toHaveValue('2');
    await expect(inputs.nth(2)).toHaveValue('0.5');
    await expect(inputs.nth(3)).toHaveValue('1');
    await expect(inputs.nth(4)).toHaveValue('1.5');
    await expect(inputs.nth(5)).toHaveValue('0.6');

    // Save and verify the swap persisted to the backend. Register the
    // response waiter BEFORE clicking so a fast round-trip isn't missed.
    const putPromise = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/budgets/${budgetId}`) && res.request().method() === 'PUT',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /^guardar$/i }).first().click();
    const put = await putPromise;
    expect(put.status()).toBe(200);

    const getRes = await request.get(`${API_BASE}/budgets/${budgetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const reread = (await getRes.json()) as AuthEnvelope<{ materials_data: string }>;
    const rows = JSON.parse(reread.data.materials_data) as MaterialRowApi[];
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.id).toBe(matB.id);
      expect(r.name).toBe(matB.name);
      expect(r.is_alternative).toBe(true);
    }
    expect(rows[0].quantity).toBe(3);
    expect(rows[0].length).toBe(2);
    expect(rows[0].width).toBe(0.5);
    expect(rows[1].quantity).toBe(1);
    expect(rows[1].length).toBe(1.5);
    expect(rows[1].width).toBe(0.6);
  });

  test('swaps a card and re-points attached pools, fabrication and additional works', async ({ page, request }) => {
    const token = await loginAndGetToken(request);
    const { matA, matB } = pickTwoMaterials(await fetchMaterials(request, token));
    const OTHER_MATERIAL = 'Otro Material No Swap';

    const API_BASE = 'http://localhost:3095/api/v1';
    const clientRes = await request.post(`${API_BASE}/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Swap Refs Client ${UNIQUE}`, phone: '+54 11 0000-0001', address: 'Calle Test 456' },
    });
    const clientBody = (await clientRes.json()) as AuthEnvelope<{ id: number }>;

    const additional_works_data = JSON.stringify([
      { additional_work_id: 1, name: 'Frente A', materialName: '__ALT__:' + matA.name, quantity: 1, price: 50, total: 50, currency: 'USD', type: 'frente', detail: null, assigned_material_id: null, formula_values: null },
      { additional_work_id: 2, name: 'Frente Otro', materialName: '__ALT__:' + OTHER_MATERIAL, quantity: 1, price: 50, total: 50, currency: 'USD', type: 'frente', detail: null, assigned_material_id: null, formula_values: null },
      { additional_work_id: 3, name: 'Pulido', materialName: '__GLOBAL__', quantity: 1, price: 0, total: 0, currency: 'ARS', type: 'flat', detail: null },
    ]);
    const pools_data = JSON.stringify([
      { pool_id: 1, brand: 'Johnson', model: 'E36', price: 50000, currency: 'ARS', quantity: 1, material: matA.name },
      { pool_id: 2, brand: 'MiPileta', model: 'Doble', price: 30000, currency: 'ARS', quantity: 1, material: OTHER_MATERIAL },
      { pool_id: 3, brand: 'G', model: 'G', price: 10000, currency: 'ARS', quantity: 1, material: '__GLOBAL__' },
    ]);
    const fabrication_details = JSON.stringify([
      { concept: 'Corte', detail: 'Recto', material: matA.name, material_price_m2: 200, length: 2, width: 1, m2: 2, labor: null, currency: 'ARS', quantity: 1, price: 400 },
      { concept: 'Pulido', detail: 'Fino', material: '', material_price_m2: 0, length: 0, width: 0, m2: 0, labor: null, currency: 'ARS', quantity: 1, price: 0 },
    ]);

    const createRes = await request.post(`${API_BASE}/budgets`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        client_id: clientBody.data.id,
        material: matA.name,
        material_price_m2: matA.base_price,
        currency: matA.currency,
        usd_rate: 1000,
        total: 1000,
        materials_data: JSON.stringify([
          {
            id: matA.id,
            name: matA.name,
            category: matA.category_id ? String(matA.category_id) : '',
            color: matA.color || '',
            price_m2: matA.base_price,
            price_m2_usd: matA.price_usd,
            currency: matA.currency,
            quantity: 1,
            m2_used: 2,
            m2_budgeted: 2,
            length: 2,
            width: 1,
            is_alternative: true,
          },
        ]),
        additional_works_data,
        pools_data,
        fabrication_details,
      },
    });
    const created = (await createRes.json()) as AuthEnvelope<{ id: number }>;
    const budgetId = created.data.id;

    await page.goto(`/admin/budgets/${budgetId}`);
    await expect(page.getByRole('button', { name: /vista previa/i })).toBeVisible({ timeout: 15_000 });

    const card = page.getByTestId('material-card').first();
    await expect(card.getByText(matA.name, { exact: true })).toBeVisible();

    await card.getByRole('button', { name: /cambiar material/i }).click();
    const pickerSelect = card.locator('select', {
      has: page.getByRole('option', { name: 'Elegir material…' }),
    });
    await pickerSelect.selectOption({ label: materialLabel(matB) });
    await expect(card.getByText(matB.name, { exact: true })).toBeVisible();

    const putPromise = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/budgets/${budgetId}`) && res.request().method() === 'PUT',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /^guardar$/i }).first().click();
    expect((await putPromise).status()).toBe(200);

    // After the swap + save the references to the old material follow
    // the card to the new material. Unrelated, global and empty
    // references remain untouched. `additional_works_data` `materialName`
    // keeps the `__ALT__:` prefix; `POOL_MATERIAL_GLOBAL` and empty
    // links are preserved.
    const finalGet = (await (await request.get(`${API_BASE}/budgets/${budgetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()) as AuthEnvelope<{
      materials_data: string;
      pools_data: string;
      fabrication_details: string;
      additional_works_data: string | null;
    }>;
    const finalMaterials = JSON.parse(finalGet.data.materials_data) as Array<{ name: string }>;
    const finalPools = JSON.parse(finalGet.data.pools_data) as Array<{ material: string }>;
    const finalFab = JSON.parse(finalGet.data.fabrication_details) as Array<{ material: string }>;
    const finalAdt = JSON.parse(finalGet.data.additional_works_data!) as Array<{ materialName: string }>;

    expect(finalMaterials[0].name).toBe(matB.name);

    expect(finalPools[0].material).toBe(matB.name);
    expect(finalPools[1].material).toBe(OTHER_MATERIAL);
    expect(finalPools[2].material).toBe('__GLOBAL__');

    expect(finalFab[0].material).toBe(matB.name);
    expect(finalFab[1].material).toBe('');

    expect(finalAdt[0].materialName).toBe('__ALT__:' + matB.name);
    expect(finalAdt[1].materialName).toBe('__ALT__:' + OTHER_MATERIAL);
    expect(finalAdt[2].materialName).toBe('__GLOBAL__');
  });
});
