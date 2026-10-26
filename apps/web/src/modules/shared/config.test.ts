import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './config';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/creno',
  POSTGRES_USER: 'u',
  POSTGRES_PASSWORD: 'p',
  POSTGRES_DB: 'creno',
  AUTH_SECRET: 'a'.repeat(32),
  APP_URL: 'http://localhost:3000',
  NODE_ENV: 'development',
};

describe('config', () => {
  it('accepts a valid development environment', () => {
    expect(parseConfig(valid).LOG_LEVEL).toBe('info');
  });

  it('names the missing variable', () => {
    const env: Record<string, string> = { ...valid };
    delete env.AUTH_SECRET;
    expect(() => parseConfig(env)).toThrowError(/AUTH_SECRET/);
  });

  it('rejects an invalid format and never echoes the value', () => {
    try {
      parseConfig({ ...valid, APP_URL: 'not-a-url' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).variables).toEqual(['APP_URL']);
      expect((e as Error).message).not.toContain('not-a-url');
    }
  });

  it('rejects a short AUTH_SECRET', () => {
    expect(() => parseConfig({ ...valid, AUTH_SECRET: 'short' })).toThrowError(/AUTH_SECRET/);
  });

  it('requires production variables in production', () => {
    expect(() => parseConfig({ ...valid, NODE_ENV: 'production' })).toThrowError(/DOMAIN/);
  });
});
