import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { AppError } from '@creno/validation';

const rootEnv = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (!process.env.DATABASE_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const openapi = parse(
  readFileSync(
    fileURLToPath(new URL('../../../../docs/api/openapi.yaml', import.meta.url)),
    'utf8',
  ),
);

// Validates a response body against a component schema of the contract (ADR-0011).
const ajv = new Ajv({ strict: false });
function conformsTo(schema: string, value: unknown): boolean {
  const validate = ajv.compile({
    components: openapi.components,
    $ref: `#/components/schemas/${schema}`,
  });
  return validate(value) as boolean;
}

const realDatabaseUrl = process.env.DATABASE_URL;
// Nothing listens on port 1: stands for a stopped database without touching the development one.
const stoppedDatabaseUrl = new URL(realDatabaseUrl ?? 'postgresql://u:p@localhost:5432/creno');
stoppedDatabaseUrl.port = '1';

async function loadHealthRoute(databaseUrl: string | undefined) {
  vi.resetModules();
  process.env.DATABASE_URL = databaseUrl;
  return import('@/app/health/route');
}

afterAll(() => {
  process.env.DATABASE_URL = realDatabaseUrl;
});

describe('GET /health', () => {
  it('answers 200 { status: "ok" } when the database responds', async () => {
    const { GET } = await loadHealthRoute(realDatabaseUrl);
    const response = await GET(new Request('http://localhost/health'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok' });
    const schema = openapi.paths['/health'].get.responses['200'].content['application/json'].schema;
    expect(new Ajv({ strict: false }).compile(schema)(body)).toBe(true);
  });

  it('answers 503 SERVICE_UNAVAILABLE, conforming to the Error schema, when the database is stopped', async () => {
    const { GET } = await loadHealthRoute(stoppedDatabaseUrl.toString());
    const response = await GET(new Request('http://localhost/health'));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Le service est momentanément indisponible.',
    });
    expect(conformsTo('Error', body)).toBe(true);
    // No technical detail leaks (host, port, driver message)
    expect(JSON.stringify(body)).not.toMatch(/localhost|5432|prisma|ECONNREFUSED/i);
  });
});

describe('error responses conform to the Error schema of openapi.yaml', () => {
  let route: typeof import('@/modules/shared').route;
  let toErrorResponse: typeof import('@/modules/shared').toErrorResponse;
  let createLogger: typeof import('@/modules/shared').createLogger;

  beforeAll(async () => {
    ({ route, toErrorResponse, createLogger } = await import('@/modules/shared'));
  });

  it('holds for every code of the catalog, with and without details', async () => {
    const { errorCatalog } = await import('@creno/validation');
    const log = createLogger({ write: () => {} });
    for (const code of Object.keys(errorCatalog) as (keyof typeof errorCatalog)[]) {
      const body = await toErrorResponse(
        new AppError(code, { slotId: 1, registeredCount: 2 }),
        'req_8f3a21c4',
        log,
      ).json();
      expect(conformsTo('Error', body), `${code}: ${JSON.stringify(body)}`).toBe(true);
    }
  });

  it('holds for a validation error and an unexpected error', async () => {
    const log = createLogger({ write: () => {} });
    const validation = await route(
      { auth: 'optional', body: z.object({ email: z.string().email() }) },
      () => ({}),
    )(new Request('http://localhost/x', { method: 'POST', body: '{"email":"nope"}' }));
    const body = await validation.json();
    expect(conformsTo('Error', body)).toBe(true);
    expect(body.details.fields).toEqual([{ field: 'email', code: 'FIELD_EMAIL_INVALID' }]);

    const unexpected = await toErrorResponse(new Error('boom'), 'req_00000000', log).json();
    expect(conformsTo('Error', unexpected)).toBe(true);
  });
});
