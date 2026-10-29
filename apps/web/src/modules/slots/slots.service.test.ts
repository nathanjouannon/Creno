import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '@/modules/shared';
import type {
  EventForSlot,
  SlotCreationTransaction,
  SlotForChange,
  SlotsRepository,
  SlotTransaction,
} from './slots.repository';
import { createSlotsService } from './slots.service';

const NOW = '2027-01-15T09:00:00Z';
const admin = { id: 1, role: 'ADMIN' } as const;

const upcomingEvent = {
  startsAt: new Date('2027-01-16T07:00:00Z'),
  endsAt: new Date('2027-01-16T16:00:00Z'),
};
const pastEvent = {
  startsAt: new Date('2027-01-15T07:00:00Z'),
  endsAt: new Date(NOW), // ends exactly now
};

function stored(overrides: Partial<SlotForChange> = {}): SlotForChange {
  return {
    id: 3,
    startsAt: new Date('2027-01-16T08:00:00Z'),
    endsAt: new Date('2027-01-16T11:00:00Z'),
    capacity: 8,
    registeredCount: 5,
    event: upcomingEvent,
    ...overrides,
  };
}

const record = (capacity: number | null) => ({
  id: 3,
  eventId: 1,
  startsAt: new Date('2027-01-16T08:00:00Z'),
  endsAt: new Date('2027-01-16T11:00:00Z'),
  capacity,
  createdAt: new Date(NOW),
  registrations: [],
});

function build(
  slot: SlotForChange | null = stored(),
  overrides: Partial<SlotsRepository> = {},
  event: EventForSlot | null = { ...upcomingEvent, registrationMode: 'FIXED' },
) {
  const tx: SlotTransaction = {
    findForChange: vi.fn().mockResolvedValue(slot),
    update: vi.fn().mockImplementation(async (_id, changes) => record(changes.capacity ?? null)),
  };
  const creation: SlotCreationTransaction = {
    findEvent: vi.fn().mockResolvedValue(event),
    create: vi.fn().mockResolvedValue(record(null)),
  };
  const repository = {
    findForChange: vi.fn().mockResolvedValue(slot),
    inEventTransaction: vi.fn(
      (_id: number, work: (t: SlotCreationTransaction) => Promise<unknown>) => work(creation),
    ),
    inSlotTransaction: vi.fn((work: (t: SlotTransaction) => Promise<unknown>) => work(tx)),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as SlotsRepository;
  return {
    service: createSlotsService({ repository, clock: fixedClock(NOW) }),
    repository,
    tx,
    creation,
  };
}

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: AppError) => error,
  );

describe('slots service (F-05, RG-07, RG-15)', () => {
  it('[F-05 S4] RG-07: a limit under the registrations is refused with their number, nothing written', async () => {
    const { service, tx } = build();
    expect(await failure(service.update(admin, 3, { capacity: 3 }))).toMatchObject({
      code: 'SLOT_CAPACITY_BELOW_REGISTRATIONS',
      details: { registeredCount: 5 },
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('RG-07: a limit equal to the registrations is accepted', async () => {
    const { service, tx } = build();
    await service.update(admin, 3, { capacity: 5 });
    expect(tx.update).toHaveBeenCalledWith(3, { capacity: 5 });
  });

  it('RG-07: an unlimited capacity is always accepted', async () => {
    const { service, tx } = build(stored({ registeredCount: 50 }));
    await service.update(admin, 3, { capacity: null });
    expect(tx.update).toHaveBeenCalledWith(3, { capacity: null });
  });

  it('RG-07: an end moved before the stored start is refused on the end field', async () => {
    const { service, tx } = build();
    expect(
      await failure(service.update(admin, 3, { endsAt: '2027-01-16T08:00:00Z' })),
    ).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { fields: [{ field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' }] },
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('RG-15: a slot of a past event is neither modified nor deleted (EVENT_PAST)', async () => {
    const { service, repository, tx } = build(stored({ event: pastEvent }));
    expect((await failure(service.update(admin, 3, { capacity: 10 })))?.code).toBe('EVENT_PAST');
    expect((await failure(service.remove(3)))?.code).toBe('EVENT_PAST');
    expect(tx.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('RG-15: no slot is added to a past event', async () => {
    const { service, creation } = build(null, {}, { ...pastEvent, registrationMode: 'FIXED' });
    const input = {
      startsAt: '2027-01-16T08:00:00Z',
      endsAt: '2027-01-16T09:00:00Z',
      capacity: null,
    };
    expect((await failure(service.create(admin, 1, input)))?.code).toBe('EVENT_PAST');
    expect(creation.create).not.toHaveBeenCalled();
  });

  it('[F-22 S16] RG-19: no fixed slot is added to an event with free slots only', async () => {
    const { service, creation } = build(null, {}, { ...upcomingEvent, registrationMode: 'FREE' });
    const input = {
      startsAt: '2027-01-16T08:00:00Z',
      endsAt: '2027-01-16T09:00:00Z',
      capacity: null,
    };
    expect((await failure(service.create(admin, 1, input)))?.code).toBe(
      'EVENT_FIXED_SLOTS_NOT_ALLOWED',
    );
    expect(creation.create).not.toHaveBeenCalled();
  });

  it('[F-22 S14] RG-19: fixed slots are added in the modes FIXED and BOTH', async () => {
    for (const registrationMode of ['FIXED', 'BOTH'] as const) {
      const { service, creation } = build(null, {}, { ...upcomingEvent, registrationMode });
      const input = {
        startsAt: '2027-01-16T08:00:00Z',
        endsAt: '2027-01-16T09:00:00Z',
        capacity: 4,
      };
      await service.create(admin, 1, input);
      expect(creation.create).toHaveBeenCalledOnce();
    }
  });

  it('unknown slot or event: SLOT_NOT_FOUND and EVENT_NOT_FOUND', async () => {
    const { service } = build(null, {}, null);
    const input = {
      startsAt: '2027-01-16T08:00:00Z',
      endsAt: '2027-01-16T09:00:00Z',
      capacity: null,
    };
    expect((await failure(service.create(admin, 1, input)))?.code).toBe('EVENT_NOT_FOUND');
    expect((await failure(service.update(admin, 3, { capacity: 2 })))?.code).toBe('SLOT_NOT_FOUND');
    expect((await failure(service.remove(3)))?.code).toBe('SLOT_NOT_FOUND');
  });
});
