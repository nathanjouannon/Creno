import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Slot } from '@/lib/api-types';
import { SlotCard } from './SlotCard';

const attendee = (id: number, displayName: string | null, isMe = false) => ({
  registrationId: id,
  displayName,
  isMe,
});

function slot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: 1,
    eventId: 1,
    startsAt: '2030-03-14T07:00:00.000Z',
    endsAt: '2030-03-14T09:00:00.000Z',
    capacity: 4,
    registeredCount: 2,
    remainingPlaces: 2,
    full: false,
    started: false,
    attendees: [attendee(1, 'Marie D.'), attendee(2, 'Paul R.')],
    ...overrides,
  };
}

const volunteer = (overrides: Partial<Slot> = {}, props = {}) =>
  render(
    <SlotCard variant="volunteer" slot={slot(overrides)} timeZone="Europe/Paris" {...props} />,
  );

describe('SlotCard volunteer', () => {
  it('[F-06 S2] RG-07, RG-09: lists the names and the remaining places of a limited slot', () => {
    volunteer({
      capacity: 4,
      registeredCount: 3,
      remainingPlaces: 1,
      attendees: [attendee(1, 'Léa B.'), attendee(2, 'Marc D.'), attendee(3, 'Sofia T.')],
    });
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Léa B.',
      'Marc D.',
      'Sofia T.',
    ]);
    expect(screen.getByText('1 place restante')).toBeInTheDocument();
  });

  it('[F-06 S3] RG-07: an unlimited slot shows no remaining count and stays open', () => {
    volunteer({ capacity: null, remainingPlaces: null });
    expect(screen.getByText('Sans limite')).toBeInTheDocument();
    expect(screen.queryByText(/restante/)).toBeNull();
    expect(screen.getByRole('button', { name: /Je m'inscris/ })).toBeEnabled();
  });

  it("[F-07 S1] open: « Je m'inscris » with the slot in its accessible name", async () => {
    const onRegister = vi.fn();
    volunteer({}, { onRegister });
    const button = screen.getByRole('button', { name: "Je m'inscris au créneau 08:00 – 10:00" });
    await userEvent.click(button);
    expect(onRegister).toHaveBeenCalledOnce();
  });

  it('[F-08 S1] registered: « Inscrit », me marked in the list, « Me désinscrire »', async () => {
    const onUnregister = vi.fn();
    volunteer({ attendees: [attendee(1, 'Alex M.', true)], registeredCount: 1 }, { onUnregister });
    expect(screen.getByText('Inscrit')).toBeInTheDocument();
    expect(screen.getByText('Alex M. (toi)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Me désinscrire/ }));
    expect(onUnregister).toHaveBeenCalledOnce();
  });

  it('[F-07 S2] RG-07: full: tag « Complet » and a disabled button', () => {
    volunteer({ full: true, remainingPlaces: 0, registeredCount: 4 });
    expect(screen.getAllByText('Complet')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Complet/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /inscris/ })).toBeNull();
  });

  it('[F-07 S4] RG-08: started, not registered: no action and the reason', () => {
    volunteer({ started: true });
    expect(screen.getByText('Commencé')).toBeInTheDocument();
    expect(screen.getByText('Ce créneau a commencé : inscription impossible')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('[F-08 S4] RG-08: started and registered: no « Me désinscrire », contact an administrator', () => {
    volunteer({ started: true, attendees: [attendee(1, 'Alex M.', true)] });
    expect(screen.getByText('Commencé · inscrit')).toBeInTheDocument();
    expect(
      screen.getByText('Contacte un administrateur pour modifier ton inscription'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('RG-11: an anonymised registration reads « ancien membre »', () => {
    volunteer({ attendees: [attendee(1, null)] });
    expect(screen.getByText('ancien membre')).toBeInTheDocument();
  });

  it('a slot without attendee shows no list', () => {
    volunteer({ registeredCount: 0, attendees: [] });
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('loading keeps the label and blocks the action', () => {
    volunteer({}, { loading: true });
    expect(screen.getByRole('button', { name: /Je m'inscris/ })).toBeDisabled();
  });
});

describe('SlotCard admin', () => {
  it('RG-08: an administrator gets the same registration button next to the counter', () => {
    render(
      <SlotCard
        variant="admin"
        slot={slot()}
        timeZone="Europe/Paris"
        onRegister={() => {}}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Je m'inscris/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Modifier le créneau/ })).toBeInTheDocument();
  });

  it('a slot being added to an event (no attendees) keeps the previous admin card', () => {
    render(
      <SlotCard
        variant="admin"
        slot={{ startsAt: slot().startsAt, endsAt: slot().endsAt, capacity: 4, registeredCount: 0 }}
        timeZone="Europe/Paris"
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /inscris/ })).toBeNull();
  });
});
