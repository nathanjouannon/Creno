import { describe, expect, it } from 'vitest';
import { displayName, slotState, toSlotView } from './slot-view';

const startsAt = new Date('2027-01-15T08:00:00Z');
const before = new Date('2027-01-15T06:00:00Z');

describe('slotState (RG-07, RG-08)', () => {
  it('RG-07: a limited slot with places left', () => {
    expect(slotState({ startsAt, capacity: 8 }, 5, before)).toEqual({
      registeredCount: 5,
      remainingPlaces: 3,
      full: false,
      started: false,
    });
  });

  it('RG-07: a limited slot at its capacity is full, with no place left', () => {
    expect(slotState({ startsAt, capacity: 4 }, 4, before)).toMatchObject({
      remainingPlaces: 0,
      full: true,
    });
  });

  it('RG-07: an empty slot has all its places', () => {
    expect(slotState({ startsAt, capacity: 4 }, 0, before)).toMatchObject({
      registeredCount: 0,
      remainingPlaces: 4,
      full: false,
    });
  });

  it('RG-07: an unlimited slot is never full and has no remaining count', () => {
    expect(slotState({ startsAt, capacity: null }, 500, before)).toMatchObject({
      remainingPlaces: null,
      full: false,
    });
  });

  it('RG-08: a slot has started at its exact start, not one millisecond before', () => {
    const justBefore = new Date(startsAt.getTime() - 1);
    expect(slotState({ startsAt, capacity: null }, 0, justBefore).started).toBe(false);
    expect(slotState({ startsAt, capacity: null }, 0, startsAt).started).toBe(true);
  });
});

describe('displayName (RG-09)', () => {
  it('is the first name and the initial of the last name', () => {
    expect(displayName({ firstName: 'Marie', lastName: 'dupont' })).toBe('Marie D.');
  });
});

describe('toSlotView (RG-09, RG-11)', () => {
  it('counts the registrations, flags "me" and leaves a former member without name', () => {
    const view = toSlotView(
      {
        id: 3,
        eventId: 1,
        startsAt,
        endsAt: new Date('2027-01-15T11:00:00Z'),
        capacity: 4,
        description: null,
        registrations: [
          { id: 1, userId: 9, user: { firstName: 'Léa', lastName: 'Bernard' } },
          { id: 2, userId: null, user: null },
        ],
      },
      before,
      9,
    );
    expect(view).toMatchObject({ registeredCount: 2, remainingPlaces: 2 });
    expect(view.attendees).toEqual([
      { registrationId: 1, displayName: 'Léa B.', isMe: true },
      { registrationId: 2, displayName: null, isMe: false },
    ]);
  });
});
