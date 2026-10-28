import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '@/modules/shared';
import { hashInvitationToken } from './invitation-token';
import type { InvitationsRepository } from './invitations.repository';
import { createInvitationsService, isStillValid } from './invitations.service';

const NOW = '2027-03-14T07:00:00Z';
const start = new Date('2027-03-14T07:00:00Z');
const later = new Date('2027-03-14T07:00:01Z');
const input = {
  firstName: 'Léa',
  lastName: 'Bernard',
  email: 'lea@exemple.fr',
  password: '0123456789',
};
const created = {
  id: 5,
  firstName: 'Léa',
  lastName: 'Bernard',
  email: 'lea@exemple.fr',
  role: 'USER' as const,
  tokenVersion: 0,
  createdAt: new Date(NOW),
};

function build(overrides: Partial<InvitationsRepository> = {}, now = NOW) {
  const repository = {
    findEventStart: vi.fn().mockResolvedValue(later),
    create: vi.fn().mockResolvedValue(undefined),
    findByTokenHash: vi
      .fn()
      .mockResolvedValue({ event: { id: 9, title: 'Course', startsAt: later } }),
    clubName: vi.fn().mockResolvedValue('Ski Club'),
    createUser: vi.fn().mockResolvedValue(created),
    ...overrides,
  } as unknown as InvitationsRepository;
  const service = createInvitationsService({
    repository,
    clock: fixedClock(now),
    appUrl: 'https://creno.example.org',
    hashPassword: async (password) => `hash:${password}`,
    openSession: async () => 'session=1',
    toUserView: (user) => ({ id: user.id }),
  });
  return { service, repository };
}

const codeOf = async (action: Promise<unknown>) => {
  try {
    await action;
  } catch (error) {
    return (error as AppError).code;
  }
  return undefined;
};

describe('isStillValid', () => {
  it('[F-01 S4] RG-02: valid strictly before the start, not at the start', () => {
    expect(isStillValid(later, new Date(NOW))).toBe(true);
    expect(isStillValid(start, new Date(NOW))).toBe(false);
  });
});

describe('create', () => {
  it('[F-01 S1] RG-02: returns a link on APP_URL ending at the start, and stores only the hash', async () => {
    const { service, repository } = build();
    const link = await service.create(9);
    expect(link.expiresAt).toBe(later.toISOString());
    const token = link.url.replace('https://creno.example.org/invitation/', '');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.create).toHaveBeenCalledWith(9, hashInvitationToken(token));
  });

  it('[F-01 S7] RG-02: refuses once the event has started', async () => {
    const { service, repository } = build({ findEventStart: vi.fn().mockResolvedValue(start) });
    expect(await codeOf(service.create(9))).toBe('EVENT_STARTED');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('refuses an unknown event', async () => {
    const { service } = build({ findEventStart: vi.fn().mockResolvedValue(null) });
    expect(await codeOf(service.create(9))).toBe('EVENT_NOT_FOUND');
  });
});

describe('check', () => {
  it('[F-01 S2] RG-02: answers with the event and the club', async () => {
    const { service, repository } = build();
    expect(await service.check('abc')).toEqual({
      eventId: 9,
      eventTitle: 'Course',
      clubName: 'Ski Club',
    });
    expect(repository.findByTokenHash).toHaveBeenCalledWith(hashInvitationToken('abc'));
  });

  it('[F-01 S1 bis] RG-02: follows the current start of the event', async () => {
    const postponed = new Date('2027-03-21T07:00:00Z');
    const { service } = build(
      {
        findByTokenHash: vi
          .fn()
          .mockResolvedValue({ event: { id: 9, title: 'Course', startsAt: postponed } }),
      },
      '2027-03-20T07:00:00Z',
    );
    expect(await service.check('abc')).toMatchObject({ eventId: 9 });
  });

  it('[F-01 S4] RG-02: an unknown link and a started event give the same refusal', async () => {
    const unknown = build({ findByTokenHash: vi.fn().mockResolvedValue(null) });
    const started = build({
      findByTokenHash: vi
        .fn()
        .mockResolvedValue({ event: { id: 9, title: 'Course', startsAt: start } }),
    });
    expect(await codeOf(unknown.service.check('x'))).toBe('INVITATION_INVALID');
    expect(await codeOf(started.service.check('x'))).toBe('INVITATION_INVALID');
  });
});

describe('accept', () => {
  it('[F-01 S2] RG-01, RG-02: creates a USER with a hashed password and opens the session', async () => {
    const { service, repository } = build();
    const accepted = await service.accept('abc', input);
    expect(accepted).toEqual({ user: { id: 5 }, eventId: 9, sessionCookie: 'session=1' });
    expect(repository.createUser).toHaveBeenCalledWith({
      firstName: 'Léa',
      lastName: 'Bernard',
      email: 'lea@exemple.fr',
      passwordHash: 'hash:0123456789',
    });
  });

  it('[F-01 S5] RG-01: an address already used is refused', async () => {
    const { service } = build({ createUser: vi.fn().mockResolvedValue(null) });
    expect(await codeOf(service.accept('abc', input))).toBe('USER_EMAIL_TAKEN');
  });

  it('[F-01 S4] RG-02: creates nothing with an expired link', async () => {
    const { service, repository } = build({ findByTokenHash: vi.fn().mockResolvedValue(null) });
    expect(await codeOf(service.accept('abc', input))).toBe('INVITATION_INVALID');
    expect(repository.createUser).not.toHaveBeenCalled();
  });
});
