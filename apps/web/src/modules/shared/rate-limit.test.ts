import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@creno/validation';
import { resetConfig } from './config';
import { fixedClock, resetClock, setClock } from './clock';
import { checkRateLimit, clientAddress, resetRateLimits } from './rate-limit';

const at = (path: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { headers });
const forwarded = (ip: string) => ({ 'x-forwarded-for': ip });
const error = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e as AppError;
  }
  return undefined;
};

beforeEach(() => {
  setClock(fixedClock('2027-01-14T09:00:10Z'));
  resetRateLimits();
  process.env.TRUST_PROXY = 'true';
  resetConfig();
});
afterEach(() => {
  resetClock();
  resetRateLimits();
  delete process.env.TRUST_PROXY;
  resetConfig();
});

describe('rate limits per IP address (security.md, section 4)', () => {
  it('lets 10 login requests through in a minute and refuses the 11th with Retry-After', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(at('/api/auth/login', forwarded('203.0.113.5')));
    const refused = error(() => checkRateLimit(at('/api/auth/login', forwarded('203.0.113.5'))));
    expect(refused?.code).toBe('RATE_LIMITED');
    expect(refused?.details?.retryAfter).toBe(60); // the window opened at the first request, now
  });

  it('shares the strict budget between /setup, /auth/login, /password-resets/* and /invitations/*', () => {
    const paths = [
      '/api/setup',
      '/api/auth/login',
      '/api/password-resets/abc',
      '/api/invitations/abc',
    ];
    for (let i = 0; i < 10; i++) checkRateLimit(at(paths[i % 4]!, forwarded('203.0.113.5')));
    for (const path of paths) {
      expect(error(() => checkRateLimit(at(path, forwarded('203.0.113.5'))))?.code).toBe(
        'RATE_LIMITED',
      );
    }
  });

  it('allows 100 requests a minute elsewhere, separately from the strict budget', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(at('/api/auth/login', forwarded('203.0.113.5')));
    for (let i = 0; i < 100; i++) checkRateLimit(at('/api/events', forwarded('203.0.113.5')));
    expect(error(() => checkRateLimit(at('/api/events', forwarded('203.0.113.5'))))?.code).toBe(
      'RATE_LIMITED',
    );
  });

  it('counts each address on its own', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(at('/api/auth/login', forwarded('203.0.113.5')));
    expect(
      error(() => checkRateLimit(at('/api/auth/login', forwarded('203.0.113.6')))),
    ).toBeUndefined();
  });

  it('tells how long to wait, down to the end of the window', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(at('/api/auth/login', forwarded('203.0.113.5')));
    setClock(fixedClock('2027-01-14T09:00:40Z'));
    const refused = error(() => checkRateLimit(at('/api/auth/login', forwarded('203.0.113.5'))));
    expect(refused?.details?.retryAfter).toBe(30);
  });

  it('starts a fresh window after a minute', () => {
    for (let i = 0; i < 11; i++)
      error(() => checkRateLimit(at('/api/auth/login', forwarded('203.0.113.5'))));
    setClock(fixedClock('2027-01-14T09:01:10Z'));
    expect(
      error(() => checkRateLimit(at('/api/auth/login', forwarded('203.0.113.5')))),
    ).toBeUndefined();
  });

  it('never limits /health', () => {
    for (let i = 0; i < 500; i++) checkRateLimit(at('/health', forwarded('203.0.113.5')));
  });
});

describe('client address and TRUST_PROXY', () => {
  it('believes the proxy header when TRUST_PROXY is true, reading the entry the proxy added (the last)', () => {
    expect(clientAddress(at('/', forwarded('6.6.6.6, 203.0.113.5')))).toBe('203.0.113.5');
  });

  it('ignores any address sent by the client when TRUST_PROXY is false: one bucket for everybody', () => {
    process.env.TRUST_PROXY = 'false';
    resetConfig();
    for (let i = 0; i < 10; i++)
      checkRateLimit(at('/api/auth/login', forwarded(`198.51.100.${i}`)));
    // A new "address" in the header does not give a fresh budget
    expect(
      error(() => checkRateLimit(at('/api/auth/login', forwarded('198.51.100.99'))))?.code,
    ).toBe('RATE_LIMITED');
    expect(clientAddress(at('/', forwarded('198.51.100.1')))).toBe('untrusted');
  });
});
