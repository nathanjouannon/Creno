import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '@/modules/shared';
import type { EventsRepository } from './events.repository';
import { createEventsService } from './events.service';

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

function build(overrides: Partial<EventsRepository> = {}) {
  const repository = {
    listUpcoming: vi.fn().mockResolvedValue([]),
    listPast: vi.fn().mockResolvedValue([]),
    findDetail: vi.fn().mockResolvedValue(null),
    findTimes: vi.fn().mockResolvedValue(upcoming),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as EventsRepository;
  return { service: createEventsService({ repository, clock: fixedClock(NOW) }), repository };
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
    const detail = { id: 5, title: 'x', description: null, location: null, ...past, slots: [] };
    const { service } = build({ findDetail: vi.fn().mockResolvedValue(detail) });
    expect(await code(service.get(user, 5))).toBe('EVENT_NOT_FOUND');
    expect((await service.get(admin, 5)).status).toBe('past');
  });

  it('RG-15: modifying or deleting a past event is refused with EVENT_PAST and writes nothing', async () => {
    const { service, repository } = build({ findTimes: vi.fn().mockResolvedValue(past) });
    expect(await code(service.update(admin, 5, { title: 'Nouveau' }))).toBe('EVENT_PAST');
    expect(await code(service.remove(5))).toBe('EVENT_PAST');
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('an unknown event is EVENT_NOT_FOUND on update and delete', async () => {
    const { service } = build({ findTimes: vi.fn().mockResolvedValue(null) });
    expect(await code(service.update(admin, 5, { title: 'x' }))).toBe('EVENT_NOT_FOUND');
    expect(await code(service.remove(5))).toBe('EVENT_NOT_FOUND');
  });

  it('[F-04 S3 bis] RG-06: a start moved after the stored end is refused on the end field', async () => {
    const { service, repository } = build();
    const error = await service
      .update(admin, 5, { startsAt: '2027-01-16T17:00:00Z' })
      .catch((e: AppError) => e);
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { fields: [{ field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' }] },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('only the fields that are sent are changed', async () => {
    const detail = {
      id: 5,
      title: 'x',
      description: null,
      location: 'Les Arcs',
      ...upcoming,
      slots: [],
    };
    const { service, repository } = build({ update: vi.fn().mockResolvedValue(detail) });
    await service.update(admin, 5, { location: 'Les Arcs' });
    expect(repository.update).toHaveBeenCalledWith(5, { location: 'Les Arcs' });
  });
});
