import { describe, expect, it } from 'vitest';
import { eventStatus, toEventDetailView } from './event-view';
import type { EventDetailRecord } from './events.repository';

const startsAt = new Date('2027-01-15T07:00:00Z');
const endsAt = new Date('2027-01-15T16:00:00Z');
const event = { startsAt, endsAt };
const at = (iso: string) => new Date(iso);

describe('eventStatus (RG-09, glossary)', () => {
  it('upcoming one millisecond before the start', () => {
    expect(eventStatus(event, at('2027-01-15T06:59:59.999Z'))).toBe('upcoming');
  });

  it('ongoing at the exact start', () => {
    expect(eventStatus(event, startsAt)).toBe('ongoing');
  });

  it('ongoing one millisecond before the end', () => {
    expect(eventStatus(event, at('2027-01-15T15:59:59.999Z'))).toBe('ongoing');
  });

  it('past at the exact end', () => {
    expect(eventStatus(event, endsAt)).toBe('past');
  });
});

function record(
  slots: Partial<EventDetailRecord['slots'][number]>[],
  freeSlots: EventDetailRecord['freeSlots'] = [],
): EventDetailRecord {
  return {
    id: 1,
    title: 'Course',
    description: null,
    location: null,
    startsAt,
    endsAt,
    registrationMode: freeSlots.length > 0 ? 'BOTH' : 'FIXED',
    createdAt: startsAt,
    freeSlots,
    slots: slots.map((slot, index) => ({
      id: index + 1,
      eventId: 1,
      startsAt,
      endsAt,
      capacity: null,
      description: null,
      createdAt: startsAt,
      registrations: [],
      ...slot,
    })),
  };
}

const registration = (id: number, userId: number | null, lastName = 'Durand') => ({
  id,
  userId,
  user: userId === null ? null : { firstName: 'Marie', lastName },
});

describe('toEventDetailView: slot states (RG-07, RG-08, RG-09, RG-11)', () => {
  const now = at('2027-01-15T06:00:00Z');

  it('RG-07: a limited slot at its capacity is full, with no place left', () => {
    const view = toEventDetailView(
      record([{ capacity: 2, registrations: [registration(1, 2), registration(2, 3)] }]),
      now,
      9,
    );
    expect(view.slots[0]).toMatchObject({ registeredCount: 2, remainingPlaces: 0, full: true });
  });

  it('RG-07: an unlimited slot is never full and has no remaining count', () => {
    const many = Array.from({ length: 500 }, (_, i) => registration(i + 1, i + 2));
    const view = toEventDetailView(record([{ capacity: null, registrations: many }]), now, 9);
    expect(view.slots[0]).toMatchObject({ remainingPlaces: null, full: false });
  });

  it('RG-08: a slot has started at its exact start, not one millisecond before', () => {
    const slots = [{}];
    expect(
      toEventDetailView(record(slots), at('2027-01-15T06:59:59.999Z'), 9).slots[0]?.started,
    ).toBe(false);
    expect(toEventDetailView(record(slots), startsAt, 9).slots[0]?.started).toBe(true);
  });

  it('RG-09, RG-11: names as "Prénom N.", "me" flagged, former member without name', () => {
    const view = toEventDetailView(
      record([{ registrations: [registration(1, 2), registration(2, 9), registration(3, null)] }]),
      now,
      9,
    );
    expect(view.slots[0]?.attendees).toEqual([
      { registrationId: 1, displayName: 'Marie D.', isMe: false },
      { registrationId: 2, displayName: 'Marie D.', isMe: true },
      { registrationId: 3, displayName: null, isMe: false },
    ]);
  });
});

describe('toEventDetailView: free slots (F-22, RG-08, RG-09, RG-11, RG-20)', () => {
  const freeSlot = (id: number, userId: number | null, start: string, end: string) => ({
    ...registration(id, userId, 'Bernard'),
    eventId: 1,
    startsAt: at(start),
    endsAt: at(end),
  });
  const leaFreeSlot = freeSlot(4, 9, '2027-01-15T09:00:00Z', '2027-01-15T11:30:00Z');

  it('[F-22 S1] RG-19: an event in fixed slots has its mode and no free slot', () => {
    const view = toEventDetailView(record([{}]), at('2027-01-15T06:00:00Z'), 9);
    expect(view.registrationMode).toBe('FIXED');
    expect(view.freeSlots).toEqual([]);
  });

  it('[F-22 S3] RG-09, RG-20: a free slot shows "Prénom N.", its times and "me"', () => {
    const view = toEventDetailView(record([], [leaFreeSlot]), at('2027-01-15T06:00:00Z'), 9);
    expect(view.freeSlots).toEqual([
      {
        id: 4,
        eventId: 1,
        startsAt: '2027-01-15T09:00:00.000Z',
        endsAt: '2027-01-15T11:30:00.000Z',
        started: false,
        displayName: 'Marie B.',
        isMe: true,
      },
    ]);
  });

  it('[F-22 S13] RG-08: a free slot has started at its exact start, not one millisecond before', () => {
    const event = record([], [leaFreeSlot]);
    expect(toEventDetailView(event, at('2027-01-15T08:59:59.999Z'), 9).freeSlots[0]?.started).toBe(
      false,
    );
    expect(toEventDetailView(event, at('2027-01-15T09:00:00Z'), 9).freeSlots[0]?.started).toBe(
      true,
    );
  });

  it('[F-22 S24] RG-11: an anonymised free slot keeps its times, without a name', () => {
    const anonymous = freeSlot(5, null, '2027-01-15T09:00:00Z', '2027-01-15T10:00:00Z');
    const view = toEventDetailView(record([], [anonymous]), at('2027-01-15T06:00:00Z'), 9);
    expect(view.freeSlots[0]).toMatchObject({ displayName: null, isMe: false });
  });

  it('[F-22 S15] RG-19: free slots never count in the filling of a fixed slot', () => {
    const view = toEventDetailView(
      record([{ capacity: 2, registrations: [registration(1, 2)] }], [leaFreeSlot]),
      at('2027-01-15T06:00:00Z'),
      9,
    );
    expect(view.slots[0]).toMatchObject({ registeredCount: 1, remainingPlaces: 1, full: false });
  });
});
