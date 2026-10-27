import { routes } from '../../../../packages/validation/src/contract';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  fakeAuthenticator,
  resetAuthenticator,
  resetRateLimits,
  route,
  setAuthenticator,
} from '@/modules/shared';

// Security model of the project (security.md, sections 3 and 4): every route of the contract that exists in the
// application must refuse an anonymous caller (401) and, for administration routes, a plain user (403).
// The test discovers routes by itself, so each new route ticket is covered without writing a new test.

type Handler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

const ORIGIN = 'http://localhost:3000';
const loaders = import.meta.glob<Record<string, Handler>>('../../src/app/api/**/route.ts');

const fileOf = (path: string) => `../../src/app/api${path.replace(/\{(\w+)\}/g, '[$1]')}/route.ts`;

async function call(handler: Handler, method: string, path: string): Promise<Response> {
  const params = Object.fromEntries(
    [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => [name!, '1']),
  );
  const request = new Request(`http://localhost/api${path.replace(/\{\w+\}/g, '1')}`, {
    method,
    headers: { origin: ORIGIN },
  });
  return handler(request, { params: Promise.resolve(params) });
}

/** Problems found when a handler is called by an anonymous caller and by a plain user. */
export async function accessProblems(
  handler: Handler,
  method: string,
  path: string,
  auth: 'user' | 'admin',
) {
  const problems: string[] = [];
  setAuthenticator(fakeAuthenticator(null));
  const anonymous = await call(handler, method, path);
  if (anonymous.status !== 401)
    problems.push(`anonymous caller got ${anonymous.status}, expected 401`);
  if (auth === 'admin') {
    setAuthenticator(fakeAuthenticator({ id: 2, role: 'USER' }));
    const user = await call(handler, method, path);
    if (user.status !== 403) problems.push(`plain user got ${user.status}, expected 403`);
  }
  return problems;
}

afterEach(() => {
  resetAuthenticator();
  resetRateLimits();
});

describe('access control of every implemented route (RG-14)', () => {
  const protectedRoutes = routes.filter((r) => r.auth !== 'public' && !r.atRoot);

  for (const definition of protectedRoutes) {
    const loader = loaders[fileOf(definition.path)];
    if (!loader) continue; // not built yet: the ticket that builds it is covered here automatically

    it(`${definition.method.toUpperCase()} ${definition.path} (${definition.auth}) refuses who may not call it`, async () => {
      const module = await loader();
      const handler = module[definition.method.toUpperCase()];
      if (!handler) return; // another method of the same path, built by a later ticket
      expect(
        await accessProblems(
          handler,
          definition.method,
          definition.path,
          definition.auth as 'user' | 'admin',
        ),
      ).toEqual([]);
    });
  }

  it('covers at least GET /me', () => {
    expect(loaders[fileOf('/me')]).toBeDefined();
    expect(protectedRoutes.some((r) => r.path === '/me')).toBe(true);
  });

  it('every administration route of the contract is declared admin, so the check above applies to it', () => {
    const adminPaths = routes.filter((r) => r.auth === 'admin').map((r) => `${r.method} ${r.path}`);
    expect(adminPaths).toContain('post /events');
    expect(adminPaths).toContain('put /users/{userId}/role');
  });
});

describe('the access check itself', () => {
  const admin = route({ auth: 'admin', body: z.object({}).optional() }, () => ({ body: {} }));
  const forgotten = route({ auth: 'user' }, () => ({ body: {} })); // an admin route wrongly opened to every user
  const open = route({ auth: 'optional' }, () => ({ body: {} }));

  it('passes a correctly protected administration route', async () => {
    expect(await accessProblems(admin as Handler, 'POST', '/events', 'admin')).toEqual([]);
  });

  it('reports an administration route that any signed-in user can call', async () => {
    expect(await accessProblems(forgotten as Handler, 'POST', '/events', 'admin')).toEqual([
      'plain user got 200, expected 403',
    ]);
  });

  it('reports a route that anonymous callers can reach', async () => {
    expect((await accessProblems(open as Handler, 'GET', '/me', 'user'))[0]).toMatch(
      /anonymous caller got 200/,
    );
  });
});
