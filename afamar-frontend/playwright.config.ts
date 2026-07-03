import { defineConfig, devices } from '@playwright/test';

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 3090);
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 3095);
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

/**
 * Playwright E2E config.
 *
 * Spins up both the FastAPI backend and the Vite dev server via `webServer`
 * so `npx playwright test` works in one command. Override with
 * `PLAYWRIGHT_BASE_URL` if you have the stack running manually.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: `cd ../afamar-backend && .\\venv\\Scripts\\python.exe -m uvicorn app.main:app --port ${BACKEND_PORT}`,
      url: `http://localhost:${BACKEND_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});