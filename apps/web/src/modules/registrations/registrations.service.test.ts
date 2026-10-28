import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '@/modules/shared';
import type { RegistrationsRepository, SlotForRegistration } from './registrations.repository';
import { assertCanRegister, createRegistrationsService } from './registrations.service';

const NOW = '2027-01-15T09:00:00Z';
const now = new Date(NOW);
const user = { id: 7, role: 'USER' } as const;
const admin = { id: 1, role: 'ADMIN' } as const;

const upcomingEvent = {
  startsAt: new Date('2027-01-15T07:00:00Z'),
  endsAt: new Date('2027-01-15T18:00:00Z'),
};
const pastEvent = { startsAt: new Date('2027-01-15T05:00:00Z'), endsAt: now }; // ends exactly now

function slot(overrides: Partial<SlotForRegistration> = {}): SlotForRegistration {
  return {
    id: 3,
    startsAt: new Date('2027-01-15T10:00:00Z'),
    capacity: 4,
    event: upcomingEvent,
    registeredUserIds: [11, 12, 13],
    ...overrides,
  };
}

const codeOf = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    return (error as AppError).code;
  }
  return undefined;
};

describe('assertCanRegister', () => {
  it('[F-07 S1] accepts a user before the start with a seat left', () => {
    expect(codeOf(() => assertCanRegister(slot(), user, now))).toBeUndefined();
  });

  it('[F-07 S4 bis] RG-08: refuses at the exact start of the slot', () => {
    expect(codeOf(() => assertCanRegister(slot({ startsAt: now }), user, now))).toBe(
      'SLOT_STARTED',
    );
  });

  it('[F-07 S4] RG-08: refuses after the start', () => {
    const started = slot({ startsAt: new Date('2027-01-15T08:59:59Z') });
    expect(codeOf(() => assertCanRegister(started, user, now))).toBe('SLOT_STARTED');
  });

  it('[F-07 S2] RG-07: refuses a full slot', () => {
    expect(codeOf(() => assertCanRegister(slot({ capacity: 3 }), user, now))).toBe('SLOT_FULL');
  });

  it('RG-07: an unlimited slot is never full', () => {
    const crowded = slot({
      capacity: null,
      registeredUserIds: Array.from({ length: 500 }, (_, i) => i + 100),
    });
    expect(codeOf(() => assertCanRegister(crowded, user, now))).toBeUndefined();
  });

  it('RG-08: refuses a second registration to the same slot', () => {
    expect(codeOf(() => assertCanRegister(slot({ registeredUserIds: [7] }), user, now))).toBe(
      'REGISTRATION_ALREADY_EXISTS',
    );
  });

  it('[F-07 S4 ter] RG-08: an administrator follows the same rules as a user', () => {
    expect(codeOf(() => assertCanRegister(slot(), admin, now))).toBeUndefined();
    expect(codeOf(() => assertCanRegister(slot({ capacity: 3 }), admin, now))).toBe('SLOT_FULL');
  });

  it('RG-09: a past event is not found for a user', () => {
    expect(codeOf(() => assertCanRegister(slot({ event: pastEvent }), user, now))).toBe(
      'SLOT_NOT_FOUND',
    );
  });

  it('RG-15: a past event answers EVENT_PAST to an administrator', () => {
    expect(codeOf(() => assertCanRegister(slot({ event: pastEvent }), admin, now))).toBe(
      'EVENT_PAST',
    );
  });
});

function build(overrides: Partial<RegistrationsRepository> = {}) {
  const repository = {
    findSlotForUnregistration: vi.fn().mockResolvedValue({
      id: 3,
      startsAt: new Date('2027-01-15T10:00:00Z'),
      event: upcomingEvent,
    }),
    deleteUserRegistration: vi.fn().mockResolvedValue(true),
    findRegistration: vi.fn().mockResolvedValue({
      id: 9,
      slotId: 3,
      userId: 7,
      slot: { startsAt: new Date('2027-01-15T08:00:00Z'), event: upcomingEvent },
    }),
    deleteRegistration: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as RegistrationsRepository;
  return {
    service: createRegistrationsService({ repository, clock: fixedClock(NOW) }),
    repository,
  };
}

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: AppError) => error.code,
  );

describe('unregister', () => {
  it('[F-08 S1] RG-08: removes the registration of the caller before the start', async () => {
    const { service, repository } = build();
    await service.unregister(user, 3);
    expect(repository.deleteUserRegistration).toHaveBeenCalledWith(3, 7);
  });

  it('[F-08 S4] RG-08: refuses once the slot has started, to the exact second', async () => {
    const { service, repository } = build({
      findSlotForUnregistration: vi
        .fn()
        .mockResolvedValue({ id: 3, startsAt: now, event: upcomingEvent }),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.unregister(user, 3))).toBe('SLOT_STARTED');
    expect(repository.deleteUserRegistration).not.toHaveBeenCalled();
  });

  it('answers REGISTRATION_NOT_FOUND when the caller is not registered', async () => {
    const { service } = build({
      deleteUserRegistration: vi.fn().mockResolvedValue(false),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.unregister(user, 3))).toBe('REGISTRATION_NOT_FOUND');
  });

  it('RG-09: a past event is not found for a user', async () => {
    const { service } = build({
      findSlotForUnregistration: vi
        .fn()
        .mockResolvedValue({ id: 3, startsAt: pastEvent.startsAt, event: pastEvent }),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.unregister(user, 3))).toBe('SLOT_NOT_FOUND');
  });
});

describe('removeRegistration', () => {
  it('[F-09 S6] RG-08: an administrator removes a registration of a started slot', async () => {
    const { service, repository } = build();
    await service.removeRegistration(admin, 9); // the slot started at 08:00, it is 09:00
    expect(repository.deleteRegistration).toHaveBeenCalledWith(9);
  });

  it('[F-09 S7] RG-15: refuses on a past event', async () => {
    const { service, repository } = build({
      findRegistration: vi.fn().mockResolvedValue({
        id: 9,
        slotId: 3,
        userId: 7,
        slot: { startsAt: pastEvent.startsAt, event: pastEvent },
      }),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.removeRegistration(admin, 9))).toBe('EVENT_PAST');
    expect(repository.deleteRegistration).not.toHaveBeenCalled();
  });

  it('answers REGISTRATION_NOT_FOUND for an unknown registration', async () => {
    const { service } = build({
      findRegistration: vi.fn().mockResolvedValue(null),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.removeRegistration(admin, 9))).toBe('REGISTRATION_NOT_FOUND');
  });
});
