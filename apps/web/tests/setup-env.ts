import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The developer's own .env comes first (the CI provides variables directly), then defaults for what is still missing.
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Defaults for the variables the tests need; real values from the environment win. None of these is a secret.
const defaults: Record<string, string> = {
  DATABASE_URL: 'postgresql://creno:creno@localhost:5432/creno',
  POSTGRES_USER: 'creno',
  POSTGRES_PASSWORD: 'creno',
  POSTGRES_DB: 'creno',
  AUTH_SECRET: 'test-only-secret-test-only-secret-0123456789',
  APP_URL: 'http://localhost:3000',
  NODE_ENV: 'test',
};
for (const [name, value] of Object.entries(defaults)) process.env[name] ||= value;
