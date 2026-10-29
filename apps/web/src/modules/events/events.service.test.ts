import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '@/modules/shared';
import type { EventForChange, EventsRepository, EventTransaction } from './events.repository';
import { assertModeAccepts, createEventsService } from './events.service';

const NOW = '2027-01-15T09:00:00Z';
const admin = { id: 1, role: 'ADMIN' } as const;
const user = { id: 2, role: 'USER' } as const;

const upcoming = {
  startsAt: new Date('2027-01-16T07:00:00Z'),
  endsAt: new Date('2027-01-16T16:00:00Z'),
};
const past = {
  startsAt: new Date('2027-01-15T07:00:00Z'),
  endsAt: new Date('2027-01-15T09:00:00Z'),
}; // ends exactly now

const detail = (times = upcoming, overrides = {}) => ({
  id: 5,
  title: 'x',
  description: null,
  location: null,
  registrationMode: 'FIXED' as const,
  createdAt: times.startsAt,
  ...times,
  slots: [],
  freeSlots: [],
  ...overrides,
});

const stored = (overrides: Partial<EventForChange> = {}): EventForChange => ({
  ...upcoming,
  registrationMode: 'FIXED',
  slotCount: 0,
  freeSlotCount: 0,
  ...overrides,
});

function build(
  overrides: Partial<EventsRepository> = {},
  current: EventForChange | null = stored(),
) {
  const tx: EventTransaction = {
    findForChange: vi.fn().mockResolvedValue(current),
    update: vi.fn().mockResolvedValue(detail()),
  };
  const repository = {
    listUpcoming: vi.fn().mockResolvedValue([]),
    listPast: vi.fn().mockResolvedValue([]),
    findDetail: vi.fn().mockResolvedValue(null),
    findTimes: vi.fn().mockResolvedValue(upcoming),
    create: vi.fn().mockResolvedValue(detail()),
    inEventTransaction: vi.fn((_id: number, work: (t: EventTransaction) => Promise<unknown>) =>
      work(tx),
    ),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as EventsRepository;
  return { service: createEventsService({ repository, clock: fixedClock(NOW) }), repository, tx };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: AppError) => error.code,
  );

describe('events service (F-04, RG-09, RG-14, RG-15)', () => {
  it('RG-09, RG-14: a user cannot list past events, and nothing is read', async () => {
    const { service, repository } = build();
    expect(await code(service.list(user, 'past'))).toBe('FORBIDDEN');
    expect(repository.listPast).not.toHaveBeenCalled();
  });

  it('RG-09: an administrator lists past events', async () => {
    const { service, repository } = build();
    await service.list(admin, 'past');
    expect(repository.listPast).toHaveBeenCalledWith(new Date(NOW));
  });

  it('RG-09: a past event is "not found" for a user but visible to an administrator', async () => {
    const { service } = build({ findDetail: vi.fn().mockResolvedValue(detail(past)) });
    expect(await code(service.get(user, 5))).toBe('EVENT_NOT_FOUND');
    expect((await service.get(admin, 5)).status).toBe('past');
  });

  it('RG-15: modifying or deleting a past event is refused with EVENT_PAST and writes nothing', async () => {
    const { service, repository, tx } = build(
      { findTimes: vi.fn().mockResolvedValue(past) },
      stored(past),
    );
    expect(await code(service.update(admin, 5, { title: 'Nouveau' }))).toBe('EVENT_PAST');
    expect(await code(service.remove(5))).toBe('EVENT_PAST');
    expect(tx.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('an unknown event is EVENT_NOT_FOUND on update and delete', async () => {
    const { service } = build({
      findTimes: vi.fn().mockResolvedValue(null),
      inEventTransaction: vi.fn().mockResolvedValue(null),
    });
    expect(await code(service.update(admin, 5, { title: 'x' }))).toBe('EVENT_NOT_FOUND');
    expect(await code(service.remove(5))).toBe('EVENT_NOT_FOUND');
  });

  it('[F-04 S3 bis] RG-06: a start moved after the stored end is refused on the end field', async () => {
    const { service, tx } = build();
    const error = await service
      .update(admin, 5, { startsAt: '2027-01-16T17:00:00Z' })
      .catch((e: AppError) => e);
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { fields: [{ field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' }] },
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('only the fields that are sent are changed', async () => {
    const { service, tx } = build();
    await service.update(admin, 5, { location: 'Les Arcs' });
    expect(tx.update).toHaveBeenCalledWith(5, { location: 'Les Arcs' });
  });
});

describe('registration mode (F-22, RG-19)', () => {
  it('[F-22 S1] RG-19: the mode given by the schema is stored, FIXED by default', async () => {
    const { service, repository } = build();
    const input = {
      title: 'Ski',
      startsAt: '2027-01-16T07:00:00Z',
      endsAt: '2027-01-16T16:00:00Z',
      registrationMode: 'FIXED' as const,
      slots: [],
    };
    await service.create(admin, input);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ registrationMode: 'FIXED' }),
    );
    await service.create(admin, { ...input, registrationMode: 'BOTH' });
    expect(repository.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ registrationMode: 'BOTH' }),
    );
  });

  it('[F-22 S16] RG-19: an event with free slots only is not created with fixed slots', async () => {
    const { service, repository } = build();
    const slot = {
      startsAt: '2027-01-16T08:00:00Z',
      endsAt: '2027-01-16T09:00:00Z',
      capacity: null,
    };
    const input = {
      title: 'Ski',
      startsAt: '2027-01-16T07:00:00Z',
      endsAt: '2027-01-16T16:00:00Z',
      registrationMode: 'FREE' as const,
      slots: [slot],
    };
    expect(await code(service.create(admin, input))).toBe('EVENT_FIXED_SLOTS_NOT_ALLOWED');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('[F-22 S17] RG-19: an event without the refused kind of slot changes mode', async () => {
    const { service, tx } = build({}, stored({ slotCount: 2 }));
    await service.update(admin, 5, { registrationMode: 'BOTH' });
    expect(tx.update).toHaveBeenCalledWith(5, { registrationMode: 'BOTH' });
  });

  it('[F-22 S18] RG-19: going to FREE with fixed slots is refused with their number, nothing written', async () => {
    const { service, tx } = build({}, stored({ registrationMode: 'BOTH', slotCount: 2 }));
    const error = await service
      .update(admin, 5, { registrationMode: 'FREE' })
      .catch((e: AppError) => e);
    expect(error).toMatchObject({ code: 'EVENT_MODE_HAS_SLOTS', details: { slotCount: 2 } });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('[F-22 S18] RG-19: going to FIXED with free slots is refused with their number', async () => {
    const { service, tx } = build({}, stored({ registrationMode: 'BOTH', freeSlotCount: 3 }));
    const error = await service
      .update(admin, 5, { registrationMode: 'FIXED' })
      .catch((e: AppError) => e);
    expect(error).toMatchObject({
      code: 'EVENT_MODE_HAS_FREE_SLOTS',
      details: { freeSlotCount: 3 },
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('RG-19: the mode rule only looks at the kind the new mode refuses', () => {
    const both = { slotCount: 2, freeSlotCount: 3 };
    expect(() => assertModeAccepts(both, 'BOTH')).not.toThrow();
    expect(() => assertModeAccepts({ slotCount: 0, freeSlotCount: 3 }, 'FREE')).not.toThrow();
    expect(() => assertModeAccepts({ slotCount: 2, freeSlotCount: 0 }, 'FIXED')).not.toThrow();
    expect(() => assertModeAccepts({ slotCount: 0, freeSlotCount: 0 }, 'FREE')).not.toThrow();
  });

  it('RG-15: the mode of a past event does not change', async () => {
    const { service, tx } = build({}, stored({ ...past }));
    expect(await code(service.update(admin, 5, { registrationMode: 'BOTH' }))).toBe('EVENT_PAST');
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('other fields can change without touching the mode', async () => {
    const { service, tx } = build({}, stored({ registrationMode: 'BOTH', slotCount: 1 }));
    await service.update(admin, 5, { title: 'Nouveau' });
    expect(tx.update).toHaveBeenCalledWith(5, { title: 'Nouveau' });
  });
});
