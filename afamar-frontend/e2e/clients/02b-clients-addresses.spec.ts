/**
 * Client alternative addresses — the 1-N `ClientAddress` rows owned by
 * each `Client`. The first address is the principal (lives on `Client.address`);
 * extras are listed in the form's "Domicilios alternativos" section.
 *
 * Pattern: capture the client ID from the POST /clients response and
 * find the row by the unique name (search uses the `search` query param
 * on the clients list).
 */
import { test, expect, type Page, type APIResponse } from '@playwright/test';
import { loginViaApi } from '../helpers/login';

const UNIQUE = `E2E-ADDR-${Math.random().toString(36).slice(2, 7)}`;

interface CreatedClient {
  id: number;
}

interface CreatedAndNamedClient {
  id: number;
  name: string;
}

async function createClientAndGetId(page: Page, name: string): Promise<CreatedAndNamedClient> {
  // Listen for the POST /clients response BEFORE the click so we don't
  // miss it.
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/clients') && r.request().method() === 'POST' && r.ok(),
  );
  await page.goto('/admin/clients');
  await page.getByRole('button', { name: /nuevo cliente/i }).click();
  const dialog = page.getByRole('dialog', { name: /nuevo cliente/i });
  await expect(dialog).toBeVisible();
  await dialog.locator('input.input, textarea.input').nth(0).fill(name);
  await dialog.getByRole('button', { name: /crear cliente/i }).click();
  await expect(dialog).toBeHidden();
  const response: APIResponse = await responsePromise;
  const body = (await response.json()) as { success: boolean; data: CreatedClient };
  if (!body.success || !body.data?.id) {
    throw new Error('Create response missing client id');
  }
  return { id: body.data.id, name };
}

async function openClientEditForm(page: Page, clientName: string): Promise<void> {
  await page.goto('/admin/clients');
  const search = page.getByPlaceholder(/buscar por nombre/i);
  await search.fill(clientName);
  const row = page.locator('tbody tr', { hasText: clientName }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  // First button in the row is the edit action.
  await row.locator('button').first().click();
  const dialog = page.getByRole('dialog', { name: /editar cliente/i });
  await expect(dialog).toBeVisible();
  void clientName;
}

async function addAddress(page: Page, label: string, address: string): Promise<void> {
  const editDialog = page.getByRole('dialog', { name: /editar cliente/i });
  await editDialog.getByRole('button', { name: /agregar domicilio/i }).click();
  // The nested address modal — last dialog rendered is the innermost one.
  const modal = page.getByRole('dialog', { name: /nuevo domicilio|editar domicilio/i });
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder('Principal').fill(label);
  await modal.getByPlaceholder(/calle.*ciudad/i).fill(address);
  await modal.getByRole('button', { name: /^agregar$|actualizar$/i }).click();
  // Wait for the modal to close and the new row to appear.
  await expect(modal).toBeHidden();
  await expect(editDialog.getByText(address)).toBeVisible();
}

test.describe('Client alternative addresses', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request);
    // `handleDeleteAddress` uses `window.confirm` (native browser dialog).
    // Auto-accept so tests can fire-and-forget the delete.
    page.on('dialog', (dialog) => dialog.accept());
  });

  test('adds an alternative address from the edit form', async ({ page }) => {
    const { name } = await createClientAndGetId(page, `Addr Add ${UNIQUE}-${Math.random().toString(36).slice(2, 7)}`);
    await openClientEditForm(page, name);
    const dialog = page.getByRole('dialog', { name: /editar cliente/i });

    // Empty state visible before any address.
    await expect(dialog.getByText(/sin domicilios alternativos/i)).toBeVisible();

    await addAddress(page, 'Casa', 'Av. Alternativa 123');

    // Address row now shows label + text.
    await expect(dialog.getByText('Casa')).toBeVisible();
    await expect(dialog.getByText('Av. Alternativa 123')).toBeVisible();
  });

  test('sets an alternative address as principal', async ({ page }) => {
    const { name } = await createClientAndGetId(page, `Addr Principal ${UNIQUE}-${Math.random().toString(36).slice(2, 7)}`);
    await openClientEditForm(page, name);
    const dialog = page.getByRole('dialog', { name: /editar cliente/i });

    // Add two addresses — the first is auto-default.
    await addAddress(page, 'Oficina', 'Calle 1 100');
    await addAddress(page, 'Deposito', 'Calle 2 200');

    // The second address shows a "Hacer principal" button (the first
    // already has the Principal badge, not a button). Use the address
    // text element + ancestor selector to scope to the row, avoiding
    // matches against outer container divs.
    const depositoRow = dialog.getByText('Calle 2 200').locator('xpath=ancestor::div[2]');
    await expect(depositoRow.getByRole('button', { name: /hacer principal/i })).toBeVisible();
    await depositoRow.getByRole('button', { name: /hacer principal/i }).click();

    // After the click, the second address becomes the principal — its row
    // now shows the "Principal" badge and no "Hacer principal" button.
    await expect(depositoRow.getByText(/principal/i)).toBeVisible();
    await expect(depositoRow.getByRole('button', { name: /hacer principal/i })).toHaveCount(0);
  });

  test('deletes an alternative address after confirming', async ({ page }) => {
    const { name } = await createClientAndGetId(page, `Addr Delete ${UNIQUE}-${Math.random().toString(36).slice(2, 7)}`);
    await openClientEditForm(page, name);
    const dialog = page.getByRole('dialog', { name: /editar cliente/i });

    // Two addresses (need 2 so the delete button is enabled).
    await addAddress(page, 'A', 'Calle A 1');
    await addAddress(page, 'B', 'Calle B 2');

    // Delete the second one. The window.confirm dialog is auto-accepted
    // by the beforeEach handler.
    const deleteButtons = dialog.getByRole('button', { name: /eliminar domicilio/i });
    await expect(deleteButtons).toHaveCount(2);
    await deleteButtons.nth(1).click();

    // Calle B 2 is gone; Calle A 1 remains.
    await expect(dialog.locator('text=Calle B 2')).toHaveCount(0);
    await expect(dialog.getByText('Calle A 1')).toBeVisible();
  });

  test('persists alternative addresses after page reload', async ({ page }) => {
    const { name } = await createClientAndGetId(page, `Addr Persist ${UNIQUE}-${Math.random().toString(36).slice(2, 7)}`);
    await openClientEditForm(page, name);

    await addAddress(page, 'Persistente', 'Calle Persistente 999');

    // Reload the page — the list comes back without the modal. Reopen
    // it and confirm the address is still there. Use exact match for
    // the label to avoid the address text ("Calle Persistente 999")
    // being a substring match.
    await page.reload();
    await openClientEditForm(page, name);
    const dialog = page.getByRole('dialog', { name: /editar cliente/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Calle Persistente 999')).toBeVisible();
    await expect(dialog.getByText('Persistente', { exact: true })).toBeVisible();
  });
});
