/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * Truncates the runtime tables so each test run starts from a clean state,
 * then re-seeds the catalogue (materials, pool stock, additional works,
 * categories) so the dev DB always has the operator-facing data the UI
 * depends on. Without the re-seed the catalogue pages would render empty
 * after the wipe and pagination could not be exercised.
 *
 * Side note: the seeder only runs once per server startup (FastAPI
 * lifespan). Calling it from Node here covers the case where the test
 * suite ran against a server that already finished bootstrapping.
 */
const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3095/api/v1';
const BACKEND_DIR = process.env.PLAYWRIGHT_BACKEND_DIR ?? '../afamar-backend';

interface AdminCreds {
  username: string;
  password: string;
}

const ADMIN: AdminCreds = {
  username: process.env.E2E_ADMIN_USER ?? 'admin',
  password: process.env.E2E_ADMIN_PASS ?? 'admin123',
};

const TABLES_TO_CLEAR = [
  'budgets',
  'work_orders',
  'measurements',
  'daily-cash',
  'cash-movements',
  'client-addresses',
  'clients',
  'pool-stock-movements',
  'pool-stock',
  'materials',
  // Material sub-resources are nested under /materials/{name} in the
  // backend router (`materials.py`). The previous flat names
  // (`material-categories`, `material-colors`, `material-thicknesses`)
  // 404'd silently, so E2E categories/colors/thicknesses accumulated
  // across suite runs and the `creates a new category via the modal`
  // test crashed with an unhandled `IntegrityError` (500) when the
  // generated `UNIQUE` collides with a leftover row.
  'materials/categories',
  'materials/colors',
  'materials/thicknesses',
  'price-history',
  'additional-works',
  'product-photos',
  'reference-data',
  'options',
];

async function loginAndGetToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { success: boolean; data: { access_token: string } };
  if (!body.success) {
    throw new Error('Login response missing success envelope');
  }
  return body.data.access_token;
}

async function truncateAll(token: string): Promise<void> {
  // Delete in reverse order — children before parents (work_orders
  // before clients, etc.).
  for (const resource of [...TABLES_TO_CLEAR].reverse()) {
    const res = await fetch(`${API_BASE}/${resource}?limit=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Some resources may not exist or may need a different verb — log
      // and continue so a missing one doesn't block the whole setup.
      console.warn(`[globalSetup] could not list ${resource}: ${res.status}`);
      continue;
    }
    const body = (await res.json()) as { success: boolean; data: Array<{ id: number }> };
    if (!body.success || !Array.isArray(body.data)) {
      console.warn(`[globalSetup] unexpected response for ${resource}`);
      continue;
    }
    for (const item of body.data) {
      const del = await fetch(`${API_BASE}/${resource}/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      // 204 = no content (success), 200 = ok. 4xx/5xx = failure (e.g.
      // 409 ConflictError because of FK constraints). Best-effort cleanup
      // — log and continue.
      if (!del.ok && del.status !== 204) {
        // Silent unless it's a non-409 error (FKs are expected for some
        // resources when the cleanup order is wrong).
        if (del.status !== 409) {
          console.warn(`[globalSetup] could not delete ${resource}/${item.id}: ${del.status}`);
        }
      }
    }
  }
  console.log(`[globalSetup] cleared ${TABLES_TO_CLEAR.length} tables`);
}

/** Re-runs the Python seeders so the catalogue tables are populated after
 *  the truncate. The seeders are idempotent — they only insert missing
 *  rows, so calling them after a wipe restores the catalogue to its
 *  pre-test state without touching rows that the tests themselves
 *  created.
 *
 *  Skip when the operator opts out via `PLAYWRIGHT_SKIP_SEED=1` (e.g.
 *  when running against a test-managed DB that the seeders would
 *  pollute). */
async function reseedCatalogue(): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_SEED === '1') {
    console.log('[globalSetup] reseed skipped (PLAYWRIGHT_SKIP_SEED=1)');
    return;
  }
  const { spawnSync } = await import('node:child_process');
  const isWindows = process.platform === 'win32';
  const python = isWindows ? '.\\venv\\Scripts\\python.exe' : './venv/bin/python';
  const result = spawnSync(python, ['-m', 'scripts.seed'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (result.status !== 0) {
    console.warn(
      `[globalSetup] reseed failed (status=${result.status}) — running tests against an empty catalogue.`,
    );
  }
}

export default async function globalSetup(): Promise<void> {
  const token = await loginAndGetToken();
  await truncateAll(token);
  await reseedCatalogue();
}
