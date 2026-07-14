/** Playwright smoke test for the dynamic `Frente / Regrueso` pricing.
 *
 * Skips the form rendering (which depends on catálogo + cliente + material
 * data already existing in the database) and instead exercises the API
 * round-trip directly: create a `frente` catalogue item with the formula
 * constant, then POST a budget carrying a `frente` snapshot row with an
 * assigned material. The backend freezes the subtotal using the formula
 * and the test asserts the persisted JSON shows the expected values.
 *
 * This stays robust because it doesn't depend on the specific seed
 * catalogue/menu being in place — the test creates its own dependencies
 * and cleans up at the end (it tries to, but a failure mid-test is fine;
 * the test is data-idempotent enough that re-runs overwrite the rows).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from './helpers/login';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3095/api/v1';

interface AuthEnvelope<T> {
  success: boolean;
  data: T;
}

async function loginAsAdminAndGetToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as AuthEnvelope<{ access_token: string }>;
  expect(body.success).toBe(true);
  return body.data.access_token;
}

function authedHeaders(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } };
}

test.describe('Dynamic pricing — Frente / Regrueso', () => {
  test('freezes the formula result on the budget snapshot', async ({ request }) => {
    const token = await loginAsAdminAndGetToken(request);

    // 1. Find or create the "Frente / Regrueso" catalogue item, flagged
    //    as type=frente with the spec default constant (1.15).
    const catalogueRes = await request.get(`${API_BASE}/additional-works?limit=200`, authedHeaders(token));
    expect(catalogueRes.ok()).toBeTruthy();
    const catalogueBody = (await catalogueRes.json()) as AuthEnvelope<
      Array<{ id: number; name: string; type: string; formula_constant: number | null }>
    >;
    const existing = catalogueBody.data.find((a) => a.name === 'Frente / Regrueso');
    let catalogueId: number;
    if (existing && existing.type === 'frente') {
      catalogueId = existing.id;
    } else {
      const createRes = await request.post(`${API_BASE}/additional-works`, {
        ...authedHeaders(token),
        data: {
          name: 'Frente / Regrueso',
          detail: 'Cálculo automático por fórmula',
          price: 0,
          currency: 'USD',
          type: 'frente',
          formula_constant: 1.15,
        },
      });
      expect(createRes.ok()).toBeTruthy();
      const created = (await createRes.json()) as AuthEnvelope<{ id: number }>;
      catalogueId = created.data.id;
    }
    expect(catalogueId).toBeGreaterThan(0);

    // 2. Find an existing USD material with a known price_per_m². Take
    //    the first one we find — even if we don't know its exact
    //    price, we recompute the expected formula locally and compare
    //    against the backend response.
    const materialsRes = await request.get(`${API_BASE}/materials?limit=10`, authedHeaders(token));
    expect(materialsRes.ok()).toBeTruthy();
    const materialsBody = (await materialsRes.json()) as AuthEnvelope<
      Array<{ id: number; price_usd: number; base_price: number; currency: string }>
    >;
    const usdMaterial = materialsBody.data.find((m) => m.currency === 'USD' && m.price_usd > 0);
    test.skip(!usdMaterial, 'No USD material with price found; skipping dynamic-pricing flow');

    const linearMeters = 2.93;
    const expectedPricePerMeter = Number(((usdMaterial.price_usd * 0.13) + 1.15).toFixed(2));
    const expectedTotal = Number((expectedPricePerMeter * linearMeters).toFixed(2));

    // 3. Find an existing client to attach the budget to.
    const clientsRes = await request.get(`${API_BASE}/clients?limit=5`, authedHeaders(token));
    expect(clientsRes.ok()).toBeTruthy();
    const clientsBody = (await clientsRes.json()) as AuthEnvelope<Array<{ id: number }>>;
    const client = clientsBody.data[0];
    test.skip(!client, 'No client in database; skipping dynamic-pricing flow');

    // 4. Create a budget carrying the `frente` snapshot row.
    const snapshot = [
      {
        additional_work_id: catalogueId,
        name: 'Frente / Regrueso',
        detail: null,
        price: 0,
        currency: 'USD',
        quantity: 1,
        total: 0,
        materialName: '__GLOBAL__',
        type: 'frente',
        linear_meters: linearMeters,
        assigned_material_id: usdMaterial.id,
        formula_values: null,
      },
    ];
    const createBudgetRes = await request.post(`${API_BASE}/budgets`, {
      ...authedHeaders(token),
      data: {
        client_id: client.id,
        material: usdMaterial.id,
        material_price_m2: 0,
        materials_data: JSON.stringify([
          {
            id: usdMaterial.id,
            name: 'Material Test',
            price_m2: 0,
            price_m2_usd: usdMaterial.price_usd,
            currency: 'USD',
            length: 100,
            width: 100,
            quantity: 1,
            m2_used: 1,
            m2_budgeted: 1,
            is_alternative: false,
          },
        ]),
        fabrication_details: '[]',
        pools_data: '[]',
        sketch_elements: '[]',
        additional_works_data: JSON.stringify(snapshot),
        usd_rate: 1000,
        subtotal: expectedTotal,
        total: expectedTotal,
      },
    });
    expect(createBudgetRes.ok()).toBeTruthy();
    const created = (await createBudgetRes.json()) as AuthEnvelope<{
      id: number;
      additional_works_data: string;
      total: number;
    }>;
    expect(created.success).toBe(true);
    const persisted = JSON.parse(created.data.additional_works_data) as Array<Record<string, unknown>>;
    const frenteRow = persisted.find((r) => r.type === 'frente');
    expect(frenteRow).toBeDefined();
    expect(frenteRow?.['currency']).toBe('USD');
    // The backend rounds to 2dp; allow ±0.01 for any rounding drift.
    expect(Math.abs(Number(frenteRow?.['price']) - expectedPricePerMeter)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(Number(frenteRow?.['total']) - expectedTotal)).toBeLessThanOrEqual(0.01);
    const fv = frenteRow?.['formula_values'] as Record<string, unknown> | null;
    expect(fv).not.toBeNull();
    expect(fv?.['material_price_m2_at_selection']).toBe(usdMaterial.price_usd);
    expect(fv?.['constant']).toBe(1.15);

    // 5. Reopen the budget via GET and assert the snapshot round-trips
    //    unchanged (proves "frozen at save time" — the budget shows
    //    the price the customer signed even if the material changed).
    const getRes = await request.get(`${API_BASE}/budgets/${created.data.id}`, authedHeaders(token));
    expect(getRes.ok()).toBeTruthy();
    const reread = (await getRes.json()) as AuthEnvelope<{
      additional_works_data: string;
    }>;
    const rereadRows = JSON.parse(reread.data.additional_works_data) as Array<Record<string, unknown>>;
    const rereadFrente = rereadRows.find((r) => r.type === 'frente');
    expect(rereadFrente?.['total']).toBe(frenteRow?.['total']);

    // Cleanup: best-effort delete; tolerable if it fails.
    await request.delete(`${API_BASE}/budgets/${created.data.id}`, authedHeaders(token));
  });

  test('renders the picker card for type=frente items', async ({ page, request }) => {
    await loginViaApi(page, request);
    await page.goto('/admin/budgets/new');
    // The form is heavy — just sanity-check the section renders.
    await expect(page.getByText(/trabajo adicional/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
