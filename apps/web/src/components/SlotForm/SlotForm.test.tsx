import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@/lib/api-client';
import { SlotForm } from './SlotForm';
import { emptySlotForm, type SlotFormValues } from './slot-form-schema';

const PARIS = 'Europe/Paris';
// 14 March 2027, 08:00 to 18:00 in Paris
const event = { startsAt: '2027-03-14T07:00:00.000Z', endsAt: '2027-03-14T17:00:00.000Z' };
const ok: ApiResult = { ok: true, data: undefined };

function open(
  onSubmit = vi.fn().mockResolvedValue(ok),
  defaultValues: SlotFormValues = emptySlotForm('2027-03-14'),
) {
  const onClose = vi.fn();
  render(
    <SlotForm
      title="Ajouter un créneau"
      timeZone={PARIS}
      event={event}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  );
  return { onSubmit, onClose };
}

async function fill(start: string, end: string, capacity = '') {
  await userEvent.type(screen.getByLabelText('Début'), start);
  await userEvent.type(screen.getByLabelText('Fin'), end);
  if (capacity) await userEvent.type(screen.getByLabelText(/Limite de places/), capacity);
}

const validate = () => userEvent.click(screen.getByRole('button', { name: 'Valider le créneau' }));

describe('SlotForm (C6, C7)', () => {
  it('[F-05 S1] RG-07: without a limit, the slot is sent unlimited, in UTC, then the window closes', async () => {
    const { onSubmit, onClose } = open();
    await fill('09:00', '12:00');
    await validate();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        startsAt: '2027-03-14T08:00:00.000Z',
        endsAt: '2027-03-14T11:00:00.000Z',
        capacity: null,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('[F-05 S3] RG-07: an end before or equal to the start is refused under the end', async () => {
    const { onSubmit } = open();
    await fill('12:00', '12:00');
    await validate();
    expect(await screen.findByText('La fin doit être après le début.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('[F-05 S3 bis] RG-07: a limit of 0 is refused under the limit', async () => {
    const { onSubmit } = open();
    await fill('09:00', '12:00', '0');
    await validate();
    expect(
      await screen.findByText("La limite doit être d'au moins 1 place (ou vide pour illimité)."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('[F-05 S3 ter] RG-07: a slot outside the event is announced but can be validated', async () => {
    const { onSubmit } = open();
    await fill('07:00', '08:00');
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Ce créneau est hors des dates de l'événement.",
    );
    await validate();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('no warning for a slot inside the event', async () => {
    open();
    await fill('09:00', '12:00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[F-05 S4] RG-07: a limit under the registrations shows the API message under the limit, the window stays', async () => {
    const message =
      '5 personnes sont déjà inscrites : retire des inscrits avant de baisser la limite.';
    const { onClose } = open(
      vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'SLOT_CAPACITY_BELOW_REGISTRATIONS', message },
      }),
      { date: '2027-03-14', startTime: '08:00', endTime: '10:00', capacity: '8' },
    );
    const limit = screen.getByLabelText(/Limite de places/);
    await userEvent.clear(limit);
    await userEvent.type(limit, '3');
    await validate();
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(limit).toHaveAttribute('aria-invalid', 'true');
    expect(limit).toHaveValue(3);
    expect(onClose).not.toHaveBeenCalled();
  });
});
