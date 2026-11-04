import { z } from 'zod';

// docs/architecture/environments.md, section 2. The app refuses to start when a required variable is missing.
const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const configSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .regex(/^postgres(ql)?:\/\//),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  // Production-only variables (Caddy, backups).
  DOMAIN: z.string().min(1).optional(),
  TRUST_PROXY: booleanString.default(false),
  BACKUP_ENCRYPTION_KEY: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

export type Config = z.infer<typeof configSchema>;

export class ConfigError extends Error {
  constructor(readonly variables: string[]) {
    super(`Invalid or missing environment variables: ${variables.join(', ')}`);
    this.name = 'ConfigError';
  }
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    // Only variable names are reported, never their values (security.md).
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new ConfigError(names);
  }
  const config = result.data;
  if (config.NODE_ENV === 'production') {
    const missing = (['DOMAIN', 'BACKUP_ENCRYPTION_KEY'] as const).filter((k) => !config[k]);
    if (!config.TRUST_PROXY) missing.push('TRUST_PROXY' as never);
    if (missing.length > 0) throw new ConfigError(missing);
  }
  return config;
}

let cached: Config | undefined;

export function getConfig(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}

/** Forgets the parsed configuration; tests call it after changing `process.env`. */
export function resetConfig(): void {
  cached = undefined;
}
