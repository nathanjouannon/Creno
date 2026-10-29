import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '@/modules/shared';
import type {
  EventForFreeSlot,
  FreeSlotTransaction,
  RegistrationsRepository,
  SlotForRegistration,
} from './registrations.repository';
import {
  assertCanCreateFreeSlot,
  assertCanRegister,
  createRegistrationsService,
  freeSlotFieldErrors,
  overlaps,
} from './registrations.service';

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
    findRegistration: vi.fn().mockResolvedValue({ id: 9, userId: 7, event: upcomingEvent }),
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
      findRegistration: vi.fn().mockResolvedValue({ id: 9, userId: 7, event: pastEvent }),
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

// F-22: an event from 07:00 to 18:00, it is 09:00
const at = (time: string) => new Date(`2027-01-15T${time}:00Z`);
const range = (start: string, end: string) => ({ startsAt: at(start), endsAt: at(end) });

function freeEvent(overrides: Partial<EventForFreeSlot> = {}): EventForFreeSlot {
  return { ...upcomingEvent, registrationMode: 'FREE', userFreeSlots: [], ...overrides };
}

describe('overlaps (RG-20)', () => {
  it('[F-22 S8] two free slots that touch do not overlap', () => {
    expect(overlaps(range('10:00', '12:00'), range('12:00', '14:00'))).toBe(false);
    expect(overlaps(range('12:00', '14:00'), range('10:00', '12:00'))).toBe(false);
  });

  it('[F-22 S9] overlapping, included or identical ranges overlap', () => {
    expect(overlaps(range('10:00', '12:00'), range('11:00', '13:00'))).toBe(true);
    expect(overlaps(range('10:00', '14:00'), range('11:00', '12:00'))).toBe(true);
    expect(overlaps(range('10:00', '12:00'), range('10:00', '12:00'))).toBe(true);
  });
});

describe('freeSlotFieldErrors (RG-08, RG-20)', () => {
  const event = upcomingEvent; // 07:00 to 18:00

  it('[F-22 S3] accepts a range inside the event, in the future, of 30 minutes or more', () => {
    expect(freeSlotFieldErrors(range('10:00', '12:30'), event, now)).toEqual([]);
    expect(freeSlotFieldErrors(range('10:00', '10:30'), event, now)).toEqual([]);
    expect(freeSlotFieldErrors(range('17:30', '18:00'), event, now)).toEqual([]);
  });

  it('[F-22 S4] a start before the event, or an end after it, is out of the event', () => {
    const before = { startsAt: new Date('2027-01-15T06:00:00Z'), endsAt: at('10:00') };
    expect(freeSlotFieldErrors(before, { ...event, startsAt: at('09:30') }, now)).toEqual([
      { field: 'startsAt', code: 'FIELD_FREE_SLOT_OUT_OF_EVENT' },
    ]);
    expect(freeSlotFieldErrors(range('17:00', '19:00'), event, now)).toEqual([
      { field: 'endsAt', code: 'FIELD_FREE_SLOT_OUT_OF_EVENT' },
    ]);
  });

  it('[F-22 S5] less than 30 minutes is too short, on the end', () => {
    expect(freeSlotFieldErrors(range('10:00', '10:20'), event, now)).toEqual([
      { field: 'endsAt', code: 'FIELD_FREE_SLOT_TOO_SHORT' },
    ]);
  });

  it('[F-22 S6] an end before the start is reported on the end', () => {
    expect(freeSlotFieldErrors(range('12:00', '10:00'), event, now)).toEqual([
      { field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' },
    ]);
  });

  it('[F-22 S7] RG-08: a start at the current time or before it is refused', () => {
    expect(freeSlotFieldErrors(range('09:00', '10:00'), event, now)).toEqual([
      { field: 'startsAt', code: 'FIELD_START_NOT_IN_FUTURE' },
    ]);
    expect(freeSlotFieldErrors(range('08:00', '10:00'), event, now)).toEqual([
      { field: 'startsAt', code: 'FIELD_START_NOT_IN_FUTURE' },
    ]);
    expect(
      freeSlotFieldErrors(
        { startsAt: new Date('2027-01-15T09:00:00.001Z'), endsAt: at('10:00') },
        event,
        now,
      ),
    ).toEqual([]);
  });

  it('[F-22 S4] RG-20: the bounds of the event come first when several rules fail on a field', () => {
    const outside = { startsAt: new Date('2027-01-15T06:00:00Z'), endsAt: at('19:00') };
    expect(freeSlotFieldErrors(outside, event, now)).toEqual([
      { field: 'startsAt', code: 'FIELD_FREE_SLOT_OUT_OF_EVENT' },
      { field: 'endsAt', code: 'FIELD_FREE_SLOT_OUT_OF_EVENT' },
    ]);
  });
});

describe('assertCanCreateFreeSlot (RG-09, RG-15, RG-19, RG-20)', () => {
  it('[F-22 S3] accepts a valid range in the modes FREE and BOTH', () => {
    for (const registrationMode of ['FREE', 'BOTH'] as const) {
      expect(
        codeOf(() =>
          assertCanCreateFreeSlot(
            freeEvent({ registrationMode }),
            range('10:00', '12:30'),
            user,
            now,
          ),
        ),
      ).toBeUndefined();
    }
  });

  it('[F-22 S16] RG-19: refuses an event in fixed slots', () => {
    const event = freeEvent({ registrationMode: 'FIXED' });
    expect(codeOf(() => assertCanCreateFreeSlot(event, range('10:00', '12:00'), user, now))).toBe(
      'EVENT_FREE_SLOTS_NOT_ALLOWED',
    );
  });

  it('[F-22 S8] accepts several free slots of one user that do not overlap', () => {
    const event = freeEvent({ userFreeSlots: [{ id: 1, ...range('10:00', '12:00') }] });
    expect(
      codeOf(() => assertCanCreateFreeSlot(event, range('12:00', '14:00'), user, now)),
    ).toBeUndefined();
  });

  it('[F-22 S9] refuses an overlap with the free slot that overlaps', () => {
    const event = freeEvent({ userFreeSlots: [{ id: 21, ...range('10:00', '12:00') }] });
    try {
      assertCanCreateFreeSlot(event, range('11:00', '13:00'), user, now);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: 'FREE_SLOT_OVERLAP', details: { freeSlotId: 21 } });
    }
  });

  it('[F-22 S4] reports the field errors as a VALIDATION_ERROR', () => {
    try {
      assertCanCreateFreeSlot(freeEvent(), range('17:00', '19:00'), user, now);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { fields: [{ field: 'endsAt', code: 'FIELD_FREE_SLOT_OUT_OF_EVENT' }] },
      });
    }
  });

  it('[F-22 S22] RG-09, RG-15: a past event is not found for a user, read only for an administrator', () => {
    const event = freeEvent(pastEvent);
    const later = range('10:00', '11:00');
    expect(codeOf(() => assertCanCreateFreeSlot(event, later, user, now))).toBe('EVENT_NOT_FOUND');
    expect(codeOf(() => assertCanCreateFreeSlot(event, later, admin, now))).toBe('EVENT_PAST');
  });

  it('[F-22 S21] an administrator follows the same rules', () => {
    const event = freeEvent({ userFreeSlots: [{ id: 1, ...range('10:00', '12:00') }] });
    expect(codeOf(() => assertCanCreateFreeSlot(event, range('11:00', '12:00'), admin, now))).toBe(
      'FREE_SLOT_OVERLAP',
    );
  });
});

function buildFreeSlots(
  event: EventForFreeSlot | null = freeEvent(),
  overrides: Partial<RegistrationsRepository> = {},
) {
  const tx: FreeSlotTransaction = {
    findEventForFreeSlot: vi.fn().mockResolvedValue(event),
    createFreeSlot: vi.fn().mockImplementation(async (freeSlot) => ({
      id: 30,
      ...freeSlot,
      user: { firstName: 'Léa', lastName: 'Bernard' },
    })),
  };
  const repository = {
    inEventTransaction: vi.fn((_id: number, work: (t: FreeSlotTransaction) => Promise<unknown>) =>
      work(tx),
    ),
    findFreeSlot: vi.fn().mockResolvedValue({
      id: 30,
      userId: 7,
      startsAt: at('10:00'),
      event: upcomingEvent,
    }),
    deleteUserFreeSlot: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as RegistrationsRepository;
  return {
    service: createRegistrationsService({ repository, clock: fixedClock(NOW) }),
    repository,
    tx,
  };
}

const input = (start: string, end: string) => ({
  startsAt: `2027-01-15T${start}:00Z`,
  endsAt: `2027-01-15T${end}:00Z`,
});

describe('createFreeSlot (F-22)', () => {
  it('[F-22 S3] creates the caller\'s free slot and returns it with "me"', async () => {
    const { service, tx } = buildFreeSlots();
    const view = await service.createFreeSlot(user, 1, input('10:00', '12:30'));
    expect(tx.createFreeSlot).toHaveBeenCalledWith({
      eventId: 1,
      userId: 7,
      ...range('10:00', '12:30'),
    });
    expect(view).toEqual({
      id: 30,
      eventId: 1,
      startsAt: '2027-01-15T10:00:00.000Z',
      endsAt: '2027-01-15T12:30:00.000Z',
      started: false,
      displayName: 'Léa B.',
      isMe: true,
    });
  });

  it('writes nothing when a rule refuses', async () => {
    const { service, tx } = buildFreeSlots(freeEvent({ registrationMode: 'FIXED' }));
    expect(await failure(service.createFreeSlot(user, 1, input('10:00', '12:00')))).toBe(
      'EVENT_FREE_SLOTS_NOT_ALLOWED',
    );
    expect(tx.createFreeSlot).not.toHaveBeenCalled();
  });

  it('an unknown event is EVENT_NOT_FOUND', async () => {
    const { service } = buildFreeSlots(null, {
      inEventTransaction: vi.fn().mockResolvedValue(null),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.createFreeSlot(user, 1, input('10:00', '12:00')))).toBe(
      'EVENT_NOT_FOUND',
    );
  });
});

describe('deleteFreeSlot (F-22)', () => {
  it("[F-22 S12] RG-08: removes the caller's free slot before its start", async () => {
    const { service, repository } = buildFreeSlots();
    await service.deleteFreeSlot(user, 30);
    expect(repository.deleteUserFreeSlot).toHaveBeenCalledWith(30, 7);
  });

  it('[F-22 S13] RG-08: refuses at the exact start of the free slot', async () => {
    const { service, repository } = buildFreeSlots(freeEvent(), {
      findFreeSlot: vi
        .fn()
        .mockResolvedValue({ id: 30, userId: 7, startsAt: now, event: upcomingEvent }),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.deleteFreeSlot(user, 30))).toBe('FREE_SLOT_STARTED');
    expect(repository.deleteUserFreeSlot).not.toHaveBeenCalled();
  });

  it('RG-14: the free slot of somebody else is not found, even for an administrator', async () => {
    const { service, repository } = buildFreeSlots();
    expect(await failure(service.deleteFreeSlot({ id: 8, role: 'USER' }, 30))).toBe(
      'FREE_SLOT_NOT_FOUND',
    );
    expect(await failure(service.deleteFreeSlot(admin, 30))).toBe('FREE_SLOT_NOT_FOUND');
    expect(repository.deleteUserFreeSlot).not.toHaveBeenCalled();
  });

  it('[F-22 S22] RG-09, RG-15: past event, not found for a user, read only for an administrator', async () => {
    const pastFreeSlot = { startsAt: at('08:00'), event: pastEvent };
    const { service } = buildFreeSlots(freeEvent(), {
      findFreeSlot: vi
        .fn()
        .mockResolvedValueOnce({ id: 30, userId: 7, ...pastFreeSlot })
        .mockResolvedValueOnce({ id: 30, userId: 1, ...pastFreeSlot }),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.deleteFreeSlot(user, 30))).toBe('FREE_SLOT_NOT_FOUND');
    expect(await failure(service.deleteFreeSlot(admin, 30))).toBe('EVENT_PAST');
  });

  it('an unknown free slot is FREE_SLOT_NOT_FOUND', async () => {
    const { service } = buildFreeSlots(freeEvent(), {
      findFreeSlot: vi.fn().mockResolvedValue(null),
    } as Partial<RegistrationsRepository>);
    expect(await failure(service.deleteFreeSlot(user, 30))).toBe('FREE_SLOT_NOT_FOUND');
  });
});
