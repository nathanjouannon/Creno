import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorCatalog } from '../errors';
import { buildArtifacts } from './build';
import { buildOpenApiDocument } from './openapi';
import { routes, sharedResponses } from './routes';

type Doc = {
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: { schemas: Record<string, unknown>; responses: Record<string, unknown> };
};
const doc = buildOpenApiDocument() as Doc;

describe('route registry', () => {
  it('declares the 27 operations of the contract with unique operation ids', () => {
    expect(routes).toHaveLength(27);
    expect(new Set(routes.map((r) => r.operationId)).size).toBe(27);
  });

  it('RG-14: every route that is not public declares its required role, and admin routes can answer 403 or 401', () => {
    for (const route of routes.filter((r) => r.auth === 'admin')) {
      const statuses = route.errors.map((e) =>
        typeof e === 'string' ? sharedResponses[e].status : e.status,
      );
      expect(statuses, route.operationId).toContain(401);
      expect(statuses.includes(403), route.operationId).toBe(true);
    }
  });

  it('only lists error codes of the catalog, with the HTTP status the catalog gives them', () => {
    for (const route of routes) {
      for (const error of route.errors) {
        const { status, codes } = typeof error === 'string' ? sharedResponses[error] : error;
        for (const code of codes)
          expect(errorCatalog[code].status, `${route.operationId} ${code}`).toBe(status);
      }
    }
  });

  it('has a params schema for every path parameter', () => {
    for (const route of routes) {
      const names = [...route.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const shape = route.params instanceof z.ZodObject ? Object.keys(route.params.shape) : [];
      expect(shape.sort(), route.path).toEqual(names.sort());
    }
  });
});

describe('generated OpenAPI document', () => {
  it('has the 27 operations, each with its role and error codes', () => {
    const operations = Object.values(doc.paths).flatMap((item) =>
      Object.values(item).filter((op) => op.operationId),
    );
    expect(operations).toHaveLength(27);
    for (const op of operations) expect(['public', 'user', 'admin']).toContain(op['x-auth']);
    expect(doc.paths['/setup']!.post!['x-auth']).toBe('public');
    expect(doc.paths['/users']!.get!['x-auth']).toBe('admin');
    expect(doc.paths['/slots/{slotId}/registrations']!.post!['x-auth']).toBe('user');
  });

  it('opts public routes out of the cookie authentication', () => {
    expect(doc.paths['/auth/login']!.post!.security).toEqual([]);
    expect(doc.paths['/me']!.get!.security).toBeUndefined();
  });

  it('keeps /health at the root, outside /api', () => {
    expect(doc.paths['/health']!.get!.servers).toEqual([
      { url: '/', description: 'À la racine, hors `/api`' },
    ]);
  });

  it('turns an example Zod schema into the expected JSON Schema (SlotInput)', () => {
    expect(doc.components.schemas.SlotInput).toMatchObject({
      type: 'object',
      required: ['startsAt', 'endsAt'],
      additionalProperties: false,
      properties: {
        startsAt: { type: 'string', format: 'date-time' },
        endsAt: { type: 'string', format: 'date-time' },
        capacity: { type: ['integer', 'null'], minimum: 1, default: null },
      },
    });
  });

  it('writes no message in a schema: Zod messages are field codes, never French text', () => {
    expect(JSON.stringify(doc.components.schemas)).not.toMatch(/FIELD_/);
  });

  it('carries the error codes of each response', () => {
    const conflict = doc.paths['/slots/{slotId}/registrations']!.post!.responses as Record<
      string,
      Record<string, unknown>
    >;
    expect(conflict['409']!['x-error-codes']).toEqual([
      'SLOT_FULL',
      'SLOT_STARTED',
      'REGISTRATION_ALREADY_EXISTS',
      'EVENT_PAST',
    ]);
  });
});

describe('generated files', () => {
  const artifacts = buildArtifacts();

  it('carry a "do not edit by hand" header', () => {
    for (const [name, content] of Object.entries(artifacts))
      expect(content, name).toMatch(/Ne pas modifier à la main/);
  });

  it('errors.json contains every code and field code of the catalog', () => {
    const json = JSON.parse(artifacts['errors.json']);
    expect(Object.keys(json.errors)).toEqual(Object.keys(errorCatalog));
    expect(json.errors.SLOT_FULL).toMatchObject({
      status: 409,
      message: "Ce créneau vient d'être complété.",
    });
    expect(Object.keys(json.fieldCodes)).toContain('FIELD_END_NOT_AFTER_START');
  });

  it('errors.md lists every code with its HTTP status and message', () => {
    for (const [code, e] of Object.entries(errorCatalog)) {
      expect(artifacts['errors.md']).toContain(`| \`${code}\` | ${e.status} | ${e.message} |`);
    }
  });

  it('is deterministic', () => {
    expect(buildArtifacts()).toEqual(artifacts);
  });
});
