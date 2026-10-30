import { describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';
import {
  EVENT_SLOTS_MAX,
  acceptInvitationInputSchema,
  eventInputSchema,
  eventUpdateSchema,
  freeSlotInputSchema,
  loginInputSchema,
  setUserRoleInputSchema,
  setupInputSchema,
  slotInputSchema,
  slotUpdateSchema,
  updateProfileInputSchema,
} from './index';

/** The field codes a schema returns for an input, by field name. */
function fieldCodes(schema: ZodTypeAny, input: unknown): Record<string, string> {
  const result = schema.safeParse(input);
  const codes: Record<string, string> = {};
  if (!result.success) {
    // First issue per field, as the route envelope reports it
    for (const issue of result.error.issues)
      codes[issue.path.join('.') || 'body'] ??= issue.message;
  }
  return codes;
}

const slot = { startsAt: '2027-01-14T09:00:00Z', endsAt: '2027-01-14T11:00:00Z' };
const person = {
  firstName: 'Léa',
  lastName: 'Bernard',
  email: 'lea@club.fr',
  password: '0123456789',
};

describe('input schemas return field codes, never messages (ADR-0009)', () => {
  it('RG-07: capacity is at least 1, or null for unlimited (default)', () => {
    expect(slotInputSchema.parse(slot).capacity).toBeNull();
    expect(slotInputSchema.parse({ ...slot, capacity: 4 }).capacity).toBe(4);
    expect(fieldCodes(slotInputSchema, { ...slot, capacity: 0 })).toEqual({
      capacity: 'FIELD_CAPACITY_TOO_LOW',
    });
  });

  it('[F-21 S1, S3] RG-07: a slot description is optional, trimmed, 500 characters at most', () => {
    expect(slotInputSchema.parse(slot).description).toBeUndefined();
    expect(slotInputSchema.parse({ ...slot, description: null }).description).toBeNull();
    expect(slotInputSchema.parse({ ...slot, description: '   ' }).description).toBe('');
    expect(slotInputSchema.parse({ ...slot, description: '  Gants fournis  ' }).description).toBe(
      'Gants fournis',
    );
    expect(
      slotInputSchema.parse({ ...slot, description: 'a'.repeat(500) }).description,
    ).toHaveLength(500);
    expect(fieldCodes(slotInputSchema, { ...slot, description: 'a'.repeat(501) })).toEqual({
      description: 'FIELD_DESCRIPTION_TOO_LONG',
    });
    // the limit applies after trimming: spaces around do not count
    expect(
      slotInputSchema.safeParse({ ...slot, description: ` ${'a'.repeat(500)} ` }).success,
    ).toBe(true);
  });

  it('[F-21 S3] RG-07: an update can change the description alone, and refuses a long one', () => {
    expect(slotUpdateSchema.parse({ description: null })).toEqual({ description: null });
    expect(fieldCodes(slotUpdateSchema, { description: 'a'.repeat(501) })).toEqual({
      description: 'FIELD_DESCRIPTION_TOO_LONG',
    });
  });

  it('RG-07: the end of a slot must be after its start, reported on endsAt', () => {
    expect(fieldCodes(slotInputSchema, { startsAt: slot.endsAt, endsAt: slot.startsAt })).toEqual({
      endsAt: 'FIELD_END_NOT_AFTER_START',
    });
    expect(fieldCodes(slotInputSchema, { startsAt: slot.startsAt, endsAt: slot.startsAt })).toEqual(
      { endsAt: 'FIELD_END_NOT_AFTER_START' },
    );
  });

  it('RG-07: a slot may exceed the dates of its event (no check against the event)', () => {
    const event = {
      title: 'Tournoi',
      startsAt: '2027-01-14T09:00:00Z',
      endsAt: '2027-01-14T12:00:00Z',
    };
    const slots = [{ startsAt: '2027-01-14T08:00:00Z', endsAt: '2027-01-14T14:00:00Z' }];
    expect(fieldCodes(eventInputSchema, { ...event, slots })).toEqual({});
  });

  it('RG-06: an event ends after it starts; slots are optional', () => {
    const event = { title: 'Tournoi', startsAt: slot.startsAt, endsAt: slot.endsAt };
    expect(eventInputSchema.parse(event).slots).toEqual([]);
    expect(fieldCodes(eventInputSchema, { ...event, endsAt: event.startsAt })).toEqual({
      endsAt: 'FIELD_END_NOT_AFTER_START',
    });
  });

  it('requires a title and valid dates', () => {
    expect(
      fieldCodes(eventInputSchema, { title: '  ', startsAt: 'demain', endsAt: undefined }),
    ).toEqual({
      title: 'FIELD_REQUIRED',
      startsAt: 'FIELD_DATE_INVALID',
      endsAt: 'FIELD_REQUIRED',
    });
  });

  it('updates accept a subset of fields but not an empty body', () => {
    expect(eventUpdateSchema.parse({ title: 'Nouveau' })).toEqual({ title: 'Nouveau' });
    expect(fieldCodes(eventUpdateSchema, {})).toEqual({ body: 'FIELD_REQUIRED' });
    expect(slotUpdateSchema.parse({ capacity: null })).toEqual({ capacity: null });
    expect(fieldCodes(slotUpdateSchema, {})).toEqual({ body: 'FIELD_REQUIRED' });
  });

  it('RG-01: a password has 10 characters at least, an e-mail is valid and trimmed', () => {
    expect(fieldCodes(acceptInvitationInputSchema, { ...person, password: '123456789' })).toEqual({
      password: 'FIELD_PASSWORD_TOO_SHORT',
    });
    expect(fieldCodes(acceptInvitationInputSchema, { ...person, email: 'pas-un-email' })).toEqual({
      email: 'FIELD_EMAIL_INVALID',
    });
    expect(fieldCodes(acceptInvitationInputSchema, { ...person, email: '' })).toEqual({
      email: 'FIELD_REQUIRED',
    });
    expect(acceptInvitationInputSchema.parse({ ...person, email: '  lea@club.fr ' }).email).toBe(
      'lea@club.fr',
    );
  });

  it('RG-16: the club time zone must be an IANA zone', () => {
    const input = { club: { name: 'Club', timezone: 'Mars/Olympus' }, admin: person };
    expect(fieldCodes(setupInputSchema, input)).toEqual({
      'club.timezone': 'FIELD_TIMEZONE_INVALID',
    });
    expect(
      fieldCodes(setupInputSchema, { ...input, club: { name: 'Club', timezone: 'Europe/Paris' } }),
    ).toEqual({});
  });

  it('refuses an unknown role and an unknown field', () => {
    expect(fieldCodes(setUserRoleInputSchema, { role: 'OWNER' })).toEqual({
      role: 'FIELD_ROLE_INVALID',
    });
    expect(setUserRoleInputSchema.safeParse({ role: 'ADMIN', extra: 1 }).success).toBe(false);
  });

  it('login does not reveal password rules: any non-empty password goes through', () => {
    expect(fieldCodes(loginInputSchema, { email: 'lea@club.fr', password: 'x' })).toEqual({});
    expect(fieldCodes(loginInputSchema, { email: 'lea@club.fr' })).toEqual({
      password: 'FIELD_REQUIRED',
    });
  });
});

describe('updateProfileInputSchema (F-20, RG-01, RG-18)', () => {
  const profile = { firstName: 'Léa', lastName: 'Bernard', email: 'lea@club.fr' };

  it('[F-20 S6] refuses an empty name or first name and a malformed address', () => {
    expect(
      fieldCodes(updateProfileInputSchema, { firstName: ' ', lastName: '', email: 'lea.club.fr' }),
    ).toEqual({
      firstName: 'FIELD_REQUIRED',
      lastName: 'FIELD_REQUIRED',
      email: 'FIELD_EMAIL_INVALID',
    });
  });

  it('RG-01: trims the address; the current password is optional here (the service decides)', () => {
    expect(updateProfileInputSchema.parse({ ...profile, email: '  lea@club.fr ' })).toEqual(
      profile,
    );
    expect(updateProfileInputSchema.parse({ ...profile, currentPassword: 'secret' })).toEqual({
      ...profile,
      currentPassword: 'secret',
    });
  });

  it('refuses a field it does not know, such as a role (RG-14)', () => {
    expect(updateProfileInputSchema.safeParse({ ...profile, role: 'ADMIN' }).success).toBe(false);
  });
});

describe('registration mode and free slots (F-22, RG-19, RG-20)', () => {
  const event = { title: 'Journée de ski', startsAt: slot.startsAt, endsAt: slot.endsAt };
  const at = (time: string) => `2027-01-14T${time}:00Z`;

  it('[F-22 S1] RG-19: an event is in fixed slots when the mode is absent', () => {
    expect(eventInputSchema.parse(event).registrationMode).toBe('FIXED');
  });

  it('[F-22 S2] RG-19: the three modes are accepted at creation and on update', () => {
    for (const registrationMode of ['FIXED', 'FREE', 'BOTH']) {
      expect(eventInputSchema.parse({ ...event, registrationMode }).registrationMode).toBe(
        registrationMode,
      );
      expect(eventUpdateSchema.parse({ registrationMode })).toEqual({ registrationMode });
    }
  });

  it('RG-19: an unknown mode is refused with its field code', () => {
    expect(fieldCodes(eventInputSchema, { ...event, registrationMode: 'free' })).toEqual({
      registrationMode: 'FIELD_REGISTRATION_MODE_INVALID',
    });
    expect(fieldCodes(eventUpdateSchema, { registrationMode: null })).toEqual({
      registrationMode: 'FIELD_REGISTRATION_MODE_INVALID',
    });
  });

  it('[F-22 S5] RG-20: a free slot lasts 30 minutes at least, reported on endsAt', () => {
    expect(fieldCodes(freeSlotInputSchema, { startsAt: at('10:00'), endsAt: at('10:20') })).toEqual(
      { endsAt: 'FIELD_FREE_SLOT_TOO_SHORT' },
    );
    expect(
      fieldCodes(freeSlotInputSchema, { startsAt: at('10:00'), endsAt: '2027-01-14T10:29:59Z' }),
    ).toEqual({ endsAt: 'FIELD_FREE_SLOT_TOO_SHORT' });
    expect(fieldCodes(freeSlotInputSchema, { startsAt: at('10:00'), endsAt: at('10:30') })).toEqual(
      {},
    );
  });

  it('RG-20: no maximum length and no step: any minute is accepted', () => {
    expect(
      fieldCodes(freeSlotInputSchema, { startsAt: at('10:07'), endsAt: '2027-01-16T23:59:00Z' }),
    ).toEqual({});
  });

  it('[F-22 S6] RG-20: the end comes after the start', () => {
    expect(fieldCodes(freeSlotInputSchema, { startsAt: at('12:00'), endsAt: at('10:00') })).toEqual(
      { endsAt: 'FIELD_END_NOT_AFTER_START' },
    );
    expect(fieldCodes(freeSlotInputSchema, { startsAt: at('12:00'), endsAt: at('12:00') })).toEqual(
      { endsAt: 'FIELD_END_NOT_AFTER_START' },
    );
  });

  it('RG-20: dates are required and valid; an unknown field such as a user id is refused (RG-14)', () => {
    expect(fieldCodes(freeSlotInputSchema, { startsAt: 'demain' })).toEqual({
      startsAt: 'FIELD_DATE_INVALID',
      endsAt: 'FIELD_REQUIRED',
    });
    const withUser = { startsAt: at('10:00'), endsAt: at('11:00'), userId: 3 };
    expect(freeSlotInputSchema.safeParse(withUser).error?.issues[0]?.code).toBe(
      'unrecognized_keys',
    );
  });
});

describe('slots sent with a new event (RG-06, #83)', () => {
  const event = { title: 'Tournoi', startsAt: slot.startsAt, endsAt: slot.endsAt };

  it('accepts 100 slots and refuses 101 with a single FIELD_TOO_MANY_SLOTS on slots', () => {
    expect(EVENT_SLOTS_MAX).toBe(100);
    expect(eventInputSchema.safeParse({ ...event, slots: Array(100).fill(slot) }).success).toBe(
      true,
    );
    const refused = eventInputSchema.safeParse({ ...event, slots: Array(101).fill({}) });
    expect(refused.error?.issues).toEqual([
      expect.objectContaining({ path: ['slots'], message: 'FIELD_TOO_MANY_SLOTS' }),
    ]);
  });

  it('GHSA-mrhx-c7xc-m3w5: a huge array of invalid slots gives one error, not one per slot', () => {
    const result = eventInputSchema.safeParse({ ...event, slots: Array(500_000).fill({}) });
    expect(result.error?.issues).toHaveLength(1);
  });
});
