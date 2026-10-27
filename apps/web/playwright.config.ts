import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// A database of its own next to the development one (environments.md, section 1); created by tests/e2e/global-setup.ts
const adminUrl = new URL(
  process.env.DATABASE_URL ?? 'postgresql://creno:creno@localhost:5432/creno',
);
const e2eUrl = new URL(adminUrl);
e2eUrl.pathname = '/creno_e2e';
process.env.E2E_ADMIN_DATABASE_URL = adminUrl.toString();
process.env.E2E_DATABASE_URL = e2eUrl.toString();

const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  // One database shared by the tests: they run one after the other
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Mobile first (360 px, AGENTS.md)
    viewport: { width: 360, height: 740 },
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Production build, as deployed: the development server rebuilds while the page is in use and loses the form state
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    // The database is created after the server starts, so /health (503 until then) cannot be the signal
    url: `http://localhost:${PORT}/api/me`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: e2eUrl.toString(),
      POSTGRES_USER: process.env.POSTGRES_USER ?? 'creno',
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'creno',
      POSTGRES_DB: 'creno_e2e',
      AUTH_SECRET: 'e2e-only-secret-e2e-only-secret-0123456789',
      APP_URL: `http://localhost:${PORT}`,
      TRUST_PROXY: 'true',
      LOG_LEVEL: 'warn',
      // Production configuration (environments.md, section 2)
      DOMAIN: 'localhost',
      BACKUP_ENCRYPTION_KEY: 'e2e-only-key',
    },
  },
});
