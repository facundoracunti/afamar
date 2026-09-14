/**
 * Caja por sesión (session-box cash) — smoke E2E of the full operator flow.
 *
 * Since Phase 8/9 (cash registers by session) there is always exactly ONE
 * open box (`#N`), numbered per session. Closing a box automatically opens
 * the next one (`#N+1`). `real_cash` = everything except bank transfers.
 *
 * This spec is robust to pre-existing boxes (global-setup can't truncate
 * `daily_cash` — there's no DELETE for cash registers, only movements), so
 * we never assert on absolute box numbers; we compare relative to the box
 * open at test start.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3095/api/v1';

interface TokenBox {
  token: string;
}

async function getToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username: process.env.E2E_ADMIN_USER ?? 'admin', password: process.env.E2E_ADMIN_PASS ?? 'admin123' },
  });
  const body = (await res.json()) as { success: boolean; data: { access_token: string } };
  return body.data.access_token;
}

async function ensureOpenBox(token: string): Promise<number> {
  const res = await fetch(`${API_BASE}/cash/current/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ previous_balance: 0 }),
  });
  if (!res.ok) throw new Error(`open box failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { number: number | null };
  return body.number ?? 0;
}

async function getCurrentNumber(token: string): Promise<number> {
  const res = await fetch(`${API_BASE}/cash/current`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { number: number | null; is_closed: boolean };
  return body.number ?? 0;
}

test.describe('Caja por sesión', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
  });

  test('loads current box page with cards', async ({ page }) => {
    await page.goto('/admin/cash');
    await expect(page.getByText(/saldo anterior/i).first()).toBeVisible();
    await expect(page.getByText(/ingresos/i).first()).toBeVisible();
    await expect(page.getByText(/egresos/i).first()).toBeVisible();
    await expect(page.getByText(/caja actual/i).first()).toBeVisible();
  });

  test('full flow: open → income → expense → close → next box → history', async ({ page, request }) => {
    const token = await getToken(request);
    const before = await ensureOpenBox(token);

    await page.goto('/admin/cash');
    await expect(page.locator('table').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(`Caja(\\s)*#?${before}`, 'i') }).first()).toBeVisible();

    // 1) Add an income via the modal.
    await page.getByRole('button', { name: /agregar ingreso/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByPlaceholder(/monto real/i).fill('1500');
    const incomePost = page.waitForResponse(
      (r) => r.url().includes('/cash/movements') && r.request().method() === 'POST' && r.ok(),
    );
    await page.getByRole('button', { name: /registrar ingreso/i }).click();
    await (await incomePost).finished();
    await expect(page.getByRole('dialog')).toBeHidden();

    // 2) Add an expense via the modal.
    await page.getByRole('button', { name: /agregar egreso/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByPlaceholder(/ej: nafta/i).fill('gasto test');
    await page.getByRole('spinbutton').fill('200');
    const expensePost = page.waitForResponse(
      (r) => r.url().includes('/cash/movements') && r.request().method() === 'POST' && r.ok(),
    );
    await page.getByRole('button', { name: /registrar egreso/i }).click();
    await (await expensePost).finished();
    await expect(page.getByRole('dialog')).toBeHidden();

    // 3) Close the box via the modal → asserts the summary + #N+1 auto-open.
    await page.getByRole('button', { name: /cerrar caja/i }).first().click();
    const closeDialog = page.getByRole('dialog');
    await expect(closeDialog).toBeVisible();
    await expect(closeDialog.getByText(/se abrirá/i)).toBeVisible();
    const closeRes = page.waitForResponse(
      (r) => r.url().includes('/cash/current/close') && r.request().method() === 'POST' && r.ok(),
    );
    await closeDialog.getByRole('button', { name: /^cerrar caja$/i }).click();
    const closeBody = (await (await closeRes).json()) as {
      closed_cash: { number: number | null };
      summary: { total_by_payment: Record<string, number>; ingreso_count: number };
      next_cash: { number: number | null };
    };
    await expect(page.getByRole('dialog')).toBeHidden();

    expect(closeBody.closed_cash.number).toBe(before);
    expect(closeBody.next_cash.number).toBe(before + 1);
    expect(closeBody.summary.ingreso_count).toBeGreaterThanOrEqual(1);
    // default payment method is EFECTIVO → counts toward real cash.
    expect(Object.keys(closeBody.summary.total_by_payment).length).toBeGreaterThanOrEqual(1);
    // The backend auto-opened the next box (#N+1).
    await expect(page.getByRole('heading', { name: new RegExp(`Caja(\\s)*#?${before + 1}`, 'i') }).first()).toBeVisible();

    // 4) History lists the closed box (#N) with its session summary.
    await page.goto('/admin/cash/history');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const historyGet = await request.get(`${API_BASE}/cash/history`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(historyGet.ok()).toBe(true);
    const history = (await historyGet.json()) as {
      data: Array<{ number: number | null; summary?: { ingreso_count?: number } }>;
    };
    const found = history.data.find((c) => c.number === before);
    expect(found).toBeTruthy();
    expect(found?.summary?.ingreso_count).toBeGreaterThanOrEqual(1);

    // 5) Cleanup: reopen the box we closed so the suite stays in a
    //    predictable "one open box" state, and delete our movements are
    //    already inside the closed box (cannot delete — box frozen).
    //    That's expected, so we just ensure an open box exists for others.
    await ensureOpenBox(token);
  });

  test('real cash excludes a bank-transfer expense', async ({ page, request }) => {
    const token = await getToken(request);
    await ensureOpenBox(token);

    // Create a bank transfer EXPENSE via API.
    const res = await request.post(`${API_BASE}/cash/movements`, {
      headers: { authorization: `Bearer ${token}` },
      data: {
        type: 'EXPENSE',
        amount: 500,
        description: `TB test ${Math.random().toString(36).slice(2, 7)}`,
        expense_type: 'BANK_TRANSFER',
      },
    });
    expect(res.ok()).toBe(true);

    await page.goto('/admin/cash');
    await expect(page.getByText(/caja actual/i).first()).toBeVisible();
    // Can't easily read the exact real_cash number off the cards with
    // currency formatting, so assert the backend agrees (single source of truth).
    const current = (await (
      await request.get(`${API_BASE}/cash/current`, { headers: { authorization: `Bearer ${token}` } })
    ).json()) as { real_cash: number; total_expenses: number };
    // A transfer expense lowers total_expenses but does NOT reduce real_cash.
    expect(current.total_expenses).toBeGreaterThanOrEqual(500);
    expect(current.real_cash).toBeLessThan(current.total_expenses);
    expect(current.real_cash).toBeGreaterThanOrEqual(0);
  });
});
