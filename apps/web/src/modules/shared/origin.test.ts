import { describe, expect, it } from 'vitest';
import { assertSameOrigin } from './origin';

const request = (method: string, origin?: string) =>
  new Request('http://localhost:3000/api/events', {
    method,
    headers: origin === undefined ? {} : { origin },
  });

describe('Origin check (ADR-0006, CSRF)', () => {
  it('accepts a request that changes data coming from the application', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(() => assertSameOrigin(request(method, 'http://localhost:3000'))).not.toThrow();
    }
  });

  it('refuses a foreign, "null" or missing Origin with FORBIDDEN_ORIGIN', () => {
    for (const origin of ['https://evil.example', 'null', 'http://localhost:3001', undefined]) {
      expect(() => assertSameOrigin(request('POST', origin))).toThrowError(
        expect.objectContaining({ code: 'FORBIDDEN_ORIGIN' }),
      );
    }
  });

  it('does not check requests that only read', () => {
    expect(() => assertSameOrigin(request('GET', 'https://evil.example'))).not.toThrow();
    expect(() => assertSameOrigin(request('GET'))).not.toThrow();
  });
});
