/**
 * Client alternative addresses — the 1-N `ClientAddress` rows owned by
 * each `Client`. The first address is the principal (lives on `Client.address`);
 * extras are listed in the form's "Domicilios alternativos" section.
 *
 * Pattern: capture the client ID from the POST /clients response and
 * navigate straight to the edit form. This avoids depending on the
 * list view (which has its own quirks — see comment in 02-clients.spec.ts).
 */
import { test, expect, type Page, type APIResponse } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-ADDR-${Math.random().toString(36).slice(2, 7)}`;

interface CreatedClient {
  id: number;
}

async function createClientAndGetId(page: Page, name: string): Promise<number> {
  // Listen for the POST /clients response BEFORE the click so we don't
  // miss it.
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/clients') && r.request().method() === 'POST' && r.ok(),
  );
  await page.goto('/admin/clients/new');
  await page.locator('input.input, textarea.input').nth(0).fill(name);
  await page.getByRole('button', { name: /crear cliente/i }).click();
  const response: APIResponse = await responsePromise;
  const body = (await response.json()) as { success: boolean; data: CreatedClient };
  if (!body.success || !body.data?.id) {
    throw new Error('Create response missing client id');
  }
  return body.data.id;
}

async function openClientEditForm(page: Page, clientId: number): Promise<void> {
  await page.goto(`/admin/clients/${clientId}`);
  await expect(page.getByRole('heading', { name: /editar cliente/i })).toBeVisible();
}

async function addAddress(page: Page, label: string, address: string): Promise<void> {
  await page.getByRole('button', { name: /agregar domicilio/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder('Principal').fill(label);
  await modal.getByPlaceholder(/calle.*ciudad/i).fill(address);
  await modal.getByRole('button', { name: /^agregar$/i }).click();
  // Wait for the modal to close and the new row to appear.
  await expect(modal).toBeHidden();
  await expect(page.getByText(address)).toBeVisible();
}

test.describe('Client alternative addresses', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
    // `handleDeleteAddress` uses `window.confirm` (native browser dialog).
    // Auto-accept so tests can fire-and-forget the delete.
    page.on('dialog', (dialog) => dialog.accept());
  });

  test('adds an alternative address from the edit form', async ({ page }) => {
    const clientId = await createClientAndGetId(page, `Addr Add ${UNIQUE}-${Math.random().toString(36).slice(2, 7)}`);
    await openClientEditForm(page, clientId);

    // Empty state visible before any address.
    await expect(page.getByText(/sin domicilios alternativos/i)).toBeVisible();

    await addAddress(page, 'Casa', 'Av. Alternativa 123');

    // Address row now shows label + text.
    await expect(page.getByText('Casa')).toBeVisible();
    await expect(page.getByText('Av. Alternativa 123')).toBeVisible();
  });

  test('sets an alternative address as principal', async ({ page }) => {
    const clientId = await createClientAndGetId(page, `Addr Principal ${UNIQUE}-${Math.random().toString(36).slice(2, 7)}`);
    await openClientEditForm(page, clientId);

    // Add two addresses — the first is auto-default.
    await addAddress(page, 'Oficina', 'Calle 1 100');
    await addAddress(page, 'Deposito', 'Calle 2 200');

    // The second address shows a "Hacer principal" button (the first
    // already has the Principal badge, not a button). Use the address
    // text element + ancestor selector to scope to the row, avoiding
    // matches against outer container divs.
    const depositoRow = page.getByText('Calle 2 200').locator('xpath=ancestor::div[2]');
    await expect(depositoRow.getByRole('button', { name: /hacer principal/i })).toBeVisible();
    await depositoRow.getByRole('button', { name: /hacer principal/i }).click();

    // After the click, the second address becomes the principal — its row
    // now shows the "Principal" badge and no "Hacer principal" button.
    await expect(depositoRow.getByText(/principal/i)).toBeVisible();
    await expect(depositoRow.getByRole('button', { name: /hacer principal/i })).toHaveCount(0);
  });

  test('deletes an alternative address after confirming', async ({ page }) => {
    const clientId = await createClientAndGetId(page, `Addr Delete ${UNIQUE}-${Math.random().toString(36).slice(2, 7)}`);
    await openClientEditForm(page, clientId);

    // Two addresses (need 2 so the delete button is enabled).
    await addAddress(page, 'A', 'Calle A 1');
    await addAddress(page, 'B', 'Calle B 2');

    // Delete the second one. The window.confirm dialog is auto-accepted
    // by the beforeEach handler.
    const deleteButtons = page.getByRole('button', { name: /eliminar domicilio/i });
    await expect(deleteButtons).toHaveCount(2);
    await deleteButtons.nth(1).click();

    // Calle B 2 is gone; Calle A 1 remains.
    await expect(page.locator('text=Calle B 2')).toHaveCount(0);
    await expect(page.getByText('Calle A 1')).toBeVisible();
  });

  test('persists alternative addresses after page reload', async ({ page }) => {
    const clientId = await createClientAndGetId(page, `Addr Persist ${UNIQUE}-${Math.random().toString(36).slice(2, 7)}`);
    await openClientEditForm(page, clientId);

    await addAddress(page, 'Persistente', 'Calle Persistente 999');

    // Reload the edit form — the address should still be there. Use
    // exact match for the label to avoid the address text
    // ("Calle Persistente 999") being a substring match.
    await page.reload();
    await expect(page.getByRole('heading', { name: /editar cliente/i })).toBeVisible();
    await expect(page.getByText('Calle Persistente 999')).toBeVisible();
    await expect(page.getByText('Persistente', { exact: true })).toBeVisible();
  });
});
