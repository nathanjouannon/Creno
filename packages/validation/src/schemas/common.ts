import { z } from 'zod';
import './openapi';

// Schemas never carry a message: they return a field code of docs/api/errors.md, section 3 (ADR-0009).
// A missing value or a value of the wrong type is a missing value for the user.
const required = { error: 'FIELD_REQUIRED' };

export const requiredString = () => z.string(required).trim().min(1, 'FIELD_REQUIRED');

/** Identifier received in a path: a string in the URL, a positive integer for the service. */
export const idParam = () =>
  z.coerce.number(required).int('FIELD_REQUIRED').min(1, 'FIELD_REQUIRED');

/** Identifier in a response body. */
export const entityId = () => z.number().int();

export const roleSchema = z
  .enum(['USER', 'ADMIN'], { error: 'FIELD_ROLE_INVALID' })
  .describe("Rôle de l'utilisateur")
  .openapi('Role');

export const passwordSchema = z
  .string(required)
  .min(10, 'FIELD_PASSWORD_TOO_SHORT')
  .describe('10 caractères minimum, aucune autre règle de complexité (RG-01). Jamais renvoyé.')
  .openapi('Password');

export const emailSchema = z
  .string(required)
  .trim()
  .min(1, 'FIELD_REQUIRED')
  .email('FIELD_EMAIL_INVALID')
  .describe('Unique sans tenir compte de la casse ; les espaces autour sont retirés (RG-01)')
  .openapi('Email');

/** ISO 8601 date-time in UTC (`2027-01-15T07:00:00Z`); shown in the club time zone (RG-16). */
export const dateTime = () => z.string(required).datetime({ message: 'FIELD_DATE_INVALID' });

/** Same format, in a response. */
export const outDateTime = () => z.string().datetime();

function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** IANA time zone (RG-16). */
export const timezoneSchema = z
  .string(required)
  .min(1, 'FIELD_REQUIRED')
  .refine(isTimezone, { message: 'FIELD_TIMEZONE_INVALID' })
  .describe('Fuseau horaire IANA');

/** Dates are compared as instants; `endsAt` must come after `startsAt` (RG-06, RG-07). */
export function endsAfterStarts(value: { startsAt?: string; endsAt?: string }): boolean {
  if (value.startsAt === undefined || value.endsAt === undefined) return true;
  return new Date(value.endsAt) > new Date(value.startsAt);
}

export const endsAfterStartsIssue = { message: 'FIELD_END_NOT_AFTER_START', path: ['endsAt'] };
