import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { middleware } from './middleware';

const state = vi.hoisted(() => ({ installed: true, signedIn: false }));
vi.mock('@/modules/club', () => ({
  getClubService: () => ({ isInstalled: async () => state.installed }),
}));
vi.mock('@/modules/auth', () => ({
  getAuthService: () => ({
    resolveSession: async () => (state.signedIn ? { id: 1, role: 'USER' } : null),
  }),
}));

const call = (path: string) => middleware(new NextRequest(`http://localhost${path}`));
const location = (response: Response) => response.headers.get('location');

describe('middleware (flow 00)', () => {
  beforeEach(() => {
    state.installed = true;
    state.signedIn = false;
  });

  it('[F-03 S3] a visitor is sent to the sign-in page, which remembers the requested page', async () => {
    const response = await call('/events/new?from=mail');
    expect(response.status).toBe(307);
    expect(location(response)).toBe(
      'http://localhost/connexion?suite=%2Fevents%2Fnew%3Ffrom%3Dmail',
    );
  });

  it('[F-03 S3] any page, even one that does not exist, needs a session', async () => {
    expect(location(await call('/nimporte/quoi'))).toContain('/connexion?suite=');
  });

  it('[F-03 S3] the sign-in page itself is open to visitors', async () => {
    const response = await call('/connexion');
    expect(location(response)).toBeNull();
  });

  it('a signed-in user goes through', async () => {
    state.signedIn = true;
    expect(location(await call('/events'))).toBeNull();
  });

  it('RG-17: before the installation, every page leads to the installation page, signed in or not', async () => {
    state.installed = false;
    expect(location(await call('/events'))).toBe('http://localhost/installation');
    expect((await call('/installation')).headers.get('location')).toBeNull();
  });
});

describe('middleware: Content-Security-Policy (security.md, section 4, #80)', () => {
  const policy = (response: Response) => response.headers.get('content-security-policy') ?? '';
  const scriptSrc = (value: string) =>
    value.split('; ').find((d) => d.startsWith('script-src')) ?? '';

  beforeEach(() => {
    state.installed = true;
    state.signedIn = true;
  });

  it('a page gets a policy whose scripts need its nonce, never unsafe-inline', async () => {
    const scripts = scriptSrc(policy(await call('/events')));
    expect(scripts).toMatch(/'nonce-[A-Za-z0-9+/]{22}=='/);
    expect(scripts).not.toContain('unsafe-inline');
  });

  it('every page gets its own nonce', async () => {
    const nonce = async () =>
      scriptSrc(policy(await call('/events'))).match(/'nonce-([^']+)'/)?.[1];
    expect(await nonce()).not.toBe(await nonce());
  });

  it('Next.js receives the same policy with the request, to put the nonce on its scripts', async () => {
    const response = await call('/events');
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(
      policy(response),
    );
  });

  it('public pages get it too: sign-in, information notice, installation', async () => {
    state.signedIn = false;
    expect(policy(await call('/connexion'))).toContain("'nonce-");
    expect(policy(await call('/mentions'))).toContain("'nonce-");
    state.installed = false;
    expect(policy(await call('/installation'))).toContain("'nonce-");
  });
});
