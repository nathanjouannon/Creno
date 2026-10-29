import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@/lib/api-client';
import { FreeSlotForm } from './FreeSlotForm';

const PARIS = 'Europe/Paris';
// 14 December 2026, 09:00 to 18:00 in Paris (UTC+1)
const event = { startsAt: '2026-12-14T08:00:00.000Z', endsAt: '2026-12-14T17:00:00.000Z' };
const ok: ApiResult = { ok: true, data: undefined };

function open(onSubmit = vi.fn().mockResolvedValue(ok)) {
  const onClose = vi.fn();
  render(<FreeSlotForm event={event} timeZone={PARIS} onSubmit={onSubmit} onClose={onClose} />);
  return { onSubmit, onClose };
}

async function setTimes(start: string, end: string) {
  const startField = screen.getByLabelText('Heure de début');
  const endField = screen.getByLabelText('Heure de fin');
  await userEvent.clear(startField);
  await userEvent.type(startField, start);
  await userEvent.clear(endField);
  await userEvent.type(endField, end);
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

describe('FreeSlotForm (B9)', () => {
  it('[F-22 S3] prefilled with the event, sends the hours in UTC and closes', async () => {
    const { onSubmit, onClose } = open();
    expect(screen.getByRole('dialog', { name: 'Choisir mes horaires' })).toBeInTheDocument();
    expect(screen.getByText('Événement : 14 décembre 09:00 → 18:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Date de début')).toHaveValue('2026-12-14');
    expect(screen.getByLabelText('Heure de début')).toHaveValue('09:00');
    expect(screen.getByLabelText('Heure de fin')).toHaveValue('18:00');
    await setTimes('10:00', '12:30');
    await save();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      startsAt: '2026-12-14T09:00:00.000Z',
      endsAt: '2026-12-14T11:30:00.000Z',
    });
  });

  it('[F-22 S5] RG-20: less than 30 minutes is refused under the end, nothing sent, values kept', async () => {
    const { onSubmit } = open();
    await setTimes('10:00', '10:20');
    await save();
    expect(
      await screen.findByText('Un créneau libre dure au moins 30 minutes.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Heure de fin')).toHaveValue('10:20');
    expect(screen.getByLabelText('Heure de fin')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('[F-22 S6] an end before the start is refused', async () => {
    const { onSubmit } = open();
    await setTimes('12:00', '10:00');
    await save();
    expect(await screen.findByText('La fin doit être après le début.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('[F-22 S4, S7] the server field errors go under the fields of the window', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Certains champs sont invalides.',
        details: {
          fields: [
            { field: 'startsAt', code: 'FIELD_START_NOT_IN_FUTURE' },
            { field: 'endsAt', code: 'FIELD_FREE_SLOT_OUT_OF_EVENT' },
          ],
        },
      },
    });
    const { onClose } = open(onSubmit);
    await save();
    expect(await screen.findByText('Choisis une heure de début à venir.')).toBeInTheDocument();
    expect(
      screen.getByText("Les horaires doivent rester dans les dates de l'événement."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('[F-22 S9] an overlap is shown in an alert at the top, the window stays open with the values', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: 'FREE_SLOT_OVERLAP',
        message: 'Tu as déjà des horaires qui recouvrent ceux-ci.',
        details: { freeSlotId: 4 },
      },
    });
    const { onClose } = open(onSubmit);
    await setTimes('11:00', '12:30');
    await save();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu as déjà des horaires qui recouvrent ceux-ci.',
    );
    expect(screen.getByLabelText('Heure de début')).toHaveValue('11:00');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('« Annuler » closes without sending', async () => {
    const { onSubmit, onClose } = open();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
