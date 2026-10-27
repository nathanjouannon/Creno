import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AppError, errorCatalog, fieldErrorCatalog, formatErrorMessage } from './index';

const errorsMd = readFileSync(
  fileURLToPath(new URL('../../../../docs/api/errors.md', import.meta.url)),
  'utf8',
);
const documented = (section: string) =>
  [
    ...errorsMd
      .split(section)[1]!
      .split(/\n## /)[0]!
      .matchAll(/^\| `(\w+)` \|/gm),
  ].map((m) => m[1]);

describe('error catalog', () => {
  it('contains exactly the codes documented in errors.md, section 2', () => {
    expect(Object.keys(errorCatalog).sort()).toEqual(documented('## 2. Codes').sort());
  });

  it('contains exactly the field codes documented in errors.md, section 3', () => {
    expect(Object.keys(fieldErrorCatalog).sort()).toEqual(
      documented('## 3. Codes de champ').sort(),
    );
  });

  it('uses UPPER_SNAKE_CASE codes and FIELD_ prefix for field codes (errors.md, section 4)', () => {
    for (const code of Object.keys(errorCatalog)) expect(code).toMatch(/^[A-Z]+(_[A-Z]+)*$/);
    for (const code of Object.keys(fieldErrorCatalog)) expect(code).toMatch(/^FIELD_[A-Z_]+$/);
  });

  it.each([
    ['VALIDATION_ERROR', 400],
    ['AUTH_REQUIRED', 401],
    ['AUTH_ACCOUNT_LOCKED', 423],
    ['FORBIDDEN', 403],
    ['SLOT_FULL', 409],
    ['RATE_LIMITED', 429],
    ['INTERNAL_ERROR', 500],
    ['SERVICE_UNAVAILABLE', 503],
  ] as const)('%s maps to HTTP %i', (code, status) => {
    expect(errorCatalog[code].status).toBe(status);
    expect(new AppError(code).status).toBe(status);
  });

  it('fills message placeholders from details', () => {
    expect(formatErrorMessage('SLOT_CAPACITY_BELOW_REGISTRATIONS', { registeredCount: 3 })).toBe(
      '3 personnes sont déjà inscrites : retire des inscrits avant de baisser la limite.',
    );
  });

  it('keeps the placeholder when the detail is missing', () => {
    expect(formatErrorMessage('SLOT_CAPACITY_BELOW_REGISTRATIONS')).toContain('{registeredCount}');
  });

  it('leaves messages without placeholder untouched', () => {
    expect(formatErrorMessage('SLOT_FULL', { slotId: 12 })).toBe(
      "Ce créneau vient d'être complété.",
    );
  });
});
