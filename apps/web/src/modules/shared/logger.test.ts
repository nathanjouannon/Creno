import { describe, expect, it } from 'vitest';
import { createLogger, maskEmail, redact } from './logger';

function capture(level?: 'debug' | 'info' | 'warn' | 'error') {
  const lines: string[] = [];
  return { lines, logger: createLogger({ level, write: (l) => lines.push(l) }) };
}

describe('maskEmail', () => {
  it('keeps the first letter of the local part and of the domain, and the extension', () => {
    expect(maskEmail('alice@domaine.fr')).toBe('a***@d***.fr');
  });

  it('masks addresses without a dot in the domain and malformed values', () => {
    expect(maskEmail('bob@localhost')).toBe('b***@l***');
    expect(maskEmail('not-an-email')).toBe('***');
  });
});

describe('log masking (security.md, section 4)', () => {
  it('masks an e-mail under an email key', () => {
    expect(redact({ email: 'alice@domaine.fr' })).toEqual({ email: 'a***@d***.fr' });
  });

  it('masks an e-mail written inside a free-text message or a nested value', () => {
    const entry = redact({
      msg: 'login failed for alice@domaine.fr',
      nested: { list: ['bob@club.org'] },
    });
    expect(JSON.stringify(entry)).not.toMatch(/alice@domaine|bob@club/);
  });

  it('replaces passwords, tokens, secrets and cookies, whatever the key casing', () => {
    const entry = redact({
      password: 'hunter2hunter2',
      newPassword: 'x',
      resetToken: 't',
      AUTH_SECRET: 's',
      cookie: 'c',
      authorization: 'Bearer z',
    });
    expect(Object.values(entry as object)).toEqual(Array(6).fill('[redacted]'));
  });

  it('serializes an Error with its stack and masks e-mail addresses in it', () => {
    const entry = redact({ err: new Error('duplicate key for alice@domaine.fr') }) as {
      err: { message: string; stack: string };
    };
    expect(entry.err.message).toBe('duplicate key for a***@d***.fr');
    expect(entry.err.stack).not.toContain('alice@domaine.fr');
  });

  it('writes one JSON line with level, time, message and bindings, masked', () => {
    const { lines, logger } = capture();
    logger
      .child({ requestId: 'req_1' })
      .info('hello', { email: 'alice@domaine.fr', password: 'secret-value' });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: 'info',
      msg: 'hello',
      requestId: 'req_1',
      email: 'a***@d***.fr',
      password: '[redacted]',
    });
    expect(lines[0]).not.toContain('secret-value');
  });

  it('skips entries below the configured level', () => {
    const { lines, logger } = capture('warn');
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(lines.map((l) => JSON.parse(l).msg)).toEqual(['c', 'd']);
  });
});
