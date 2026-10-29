import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FreeSlot } from '@/lib/api-types';
import { FreeSlotList, freeSlotHours } from './FreeSlotList';

const PARIS = 'Europe/Paris';

// 14 December, local times in Paris (UTC+1)
function freeSlot(id: number, displayName: string | null, start: string, end: string, more = {}) {
  return {
    id,
    eventId: 1,
    startsAt: `2026-12-14T${start}:00.000Z`,
    endsAt: `2026-12-14T${end}:00.000Z`,
    started: false,
    displayName,
    isMe: false,
    ...more,
  } satisfies FreeSlot;
}

const lea = freeSlot(1, 'Léa B.', '09:00', '11:30', { isMe: true });
const marc = freeSlot(2, 'Marc D.', '10:00', '12:00', { started: true });
const sofia = freeSlot(3, 'Sofia T.', '13:00', '15:00');

describe('FreeSlotList volunteer (B8)', () => {
  it("[F-22 S3] RG-09: names and hours by row, « (toi) » and « Me désinscrire » on one's own row", async () => {
    const onUnregister = vi.fn();
    render(
      <FreeSlotList
        variant="volunteer"
        freeSlots={[lea, marc, sofia]}
        timeZone={PARIS}
        onChoose={vi.fn()}
        onUnregister={onUnregister}
      />,
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Léa B. (toi)10:00 – 12:30'),
      'Marc D.Commencé11:00 – 13:00',
      'Sofia T.14:00 – 16:00',
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Me désinscrire, 10:00 – 12:30' }));
    expect(onUnregister).toHaveBeenCalledWith(lea);
    // RG-20: no limit, never full
    expect(screen.queryByText(/Complet|places?/)).not.toBeInTheDocument();
  });

  it("[F-22 S13] RG-08: one's own started free slot has no button, but the message", () => {
    render(
      <FreeSlotList
        variant="volunteer"
        freeSlots={[{ ...lea, started: true }]}
        timeZone={PARIS}
        onUnregister={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Me désinscrire/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Contacte un administrateur pour modifier ton inscription'),
    ).toBeInTheDocument();
  });

  it('« Choisir mes horaires » is the main action until the user has hours, then secondary', () => {
    const { rerender } = render(
      <FreeSlotList variant="volunteer" freeSlots={[sofia]} timeZone={PARIS} onChoose={vi.fn()} />,
    );
    const choose = () => screen.getByRole('button', { name: 'Choisir mes horaires' });
    expect(choose().className).toContain('bg-primary');
    rerender(
      <FreeSlotList variant="volunteer" freeSlots={[lea]} timeZone={PARIS} onChoose={vi.fn()} />,
    );
    expect(choose().className).not.toContain('bg-primary');
  });

  it('empty: an invitation to choose, with the intro of the mode « Créneaux libres »', () => {
    render(
      <FreeSlotList
        variant="volunteer"
        freeSlots={[]}
        timeZone={PARIS}
        intro="Choisis les heures où tu es disponible."
        onChoose={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Créneaux libres' })).toBeInTheDocument();
    expect(screen.getByText('Choisis les heures où tu es disponible.')).toBeInTheDocument();
    expect(
      screen.getByText("Personne ne s'est encore inscrit. Choisis tes horaires."),
    ).toBeInTheDocument();
  });

  it('RG-11: a former member keeps the hours, without a name', () => {
    render(
      <FreeSlotList
        variant="volunteer"
        freeSlots={[{ ...sofia, displayName: null }]}
        timeZone={PARIS}
      />,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent('ancien membre14:00 – 16:00');
  });
});

describe('FreeSlotList admin (C2)', () => {
  it('[F-22 S19, S20] count in the title, « × » named after the person and the hours, even started', async () => {
    const onRemove = vi.fn();
    render(
      <FreeSlotList
        variant="admin"
        freeSlots={[lea, marc, sofia]}
        timeZone={PARIS}
        onChoose={vi.fn()}
        onUnregister={vi.fn()}
        onRemove={onRemove}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Créneaux libres · 3 inscrits' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer Marc D., 11:00 – 13:00' }));
    expect(onRemove).toHaveBeenCalledWith(marc);
    expect(
      screen.getByRole('button', { name: 'Retirer Sofia T., 14:00 – 16:00' }),
    ).toBeInTheDocument();
    // The administrator's own row: « Me désinscrire », no « × »
    const own = screen.getAllByRole('listitem')[0]!;
    expect(within(own).queryByRole('button', { name: /Retirer/ })).not.toBeInTheDocument();
    expect(within(own).getByRole('button', { name: /Me désinscrire/ })).toBeInTheDocument();
  });

  it('empty: no « Aucun inscrit » alert, a free slot has no limit (RG-20)', () => {
    render(<FreeSlotList variant="admin" freeSlots={[]} timeZone={PARIS} onChoose={vi.fn()} />);
    expect(screen.getByText('Aucun inscrit pour le moment.')).toBeInTheDocument();
    expect(screen.queryByText(/\(!\)/)).not.toBeInTheDocument();
  });
});

describe('FreeSlotList readonly (RG-15)', () => {
  it('[F-22 S22] a past event shows the free slots without any action', () => {
    render(
      <FreeSlotList
        variant="readonly"
        freeSlots={[lea, marc]}
        timeZone={PARIS}
        onChoose={vi.fn()}
        onUnregister={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('freeSlotHours (RG-16)', () => {
  it('hours alone, with the day on an event of several days, both days over midnight', () => {
    expect(freeSlotHours(lea, PARIS)).toBe('10:00 – 12:30');
    expect(freeSlotHours(lea, PARIS, true)).toBe('14 décembre, 10:00 – 12:30');
    const night = {
      ...lea,
      startsAt: '2026-12-14T21:00:00.000Z',
      endsAt: '2026-12-15T01:00:00.000Z',
    };
    expect(freeSlotHours(night, PARIS)).toBe('14 décembre 22:00 → 15 décembre 02:00');
  });
});
