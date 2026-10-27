import { describe, expect, it } from 'vitest';
import { safeDestination } from './destination';

describe('destination after sign-in', () => {
  it('[F-02 S1 bis] accepts a path of the application, with its query', () => {
    expect(safeDestination('/events/12')).toBe('/events/12');
    expect(safeDestination('/events?scope=past')).toBe('/events?scope=past');
  });

  it('refuses other sites, whatever the trick', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      'evil.example',
      '/ok\\..\\x',
      '/a\nb',
    ]) {
      expect(safeDestination(value), value).toBeNull();
    }
  });

  it('refuses the sign-in, installation and API paths (no loop)', () => {
    for (const value of ['/connexion', '/connexion?suite=/events', '/installation', '/api/me']) {
      expect(safeDestination(value), value).toBeNull();
    }
  });

  it('refuses nothing, empty and absurdly long values', () => {
    expect(safeDestination(null)).toBeNull();
    expect(safeDestination(undefined)).toBeNull();
    expect(safeDestination('')).toBeNull();
    expect(safeDestination(`/${'a'.repeat(600)}`)).toBeNull();
  });
});
