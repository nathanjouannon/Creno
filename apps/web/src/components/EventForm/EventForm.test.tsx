import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventForm } from './EventForm';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterEach(() => {
  fetchMock.mockReset();
  push.mockReset();
});

async function fillEvent(title = 'Course de ski') {
  if (title) await userEvent.type(screen.getByLabelText('Titre'), title);
  await userEvent.type(screen.getByLabelText('Date de début'), '2027-03-14');
  await userEvent.type(screen.getByLabelText('Heure de début'), '08:00');
  await userEvent.type(screen.getByLabelText('Date de fin'), '2027-03-14');
  await userEvent.type(screen.getByLabelText('Heure de fin'), '18:00');
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

describe('EventForm (C4, C5)', () => {
  it('[F-04 S2] an empty title shows « Le titre est obligatoire. » and sends nothing', async () => {
    render(<EventForm timeZone="Europe/Paris" />);
    await fillEvent('');
    await save();
    expect(await screen.findByText('Le titre est obligatoire.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[F-04 S3 bis] RG-06: an end before the start is refused, the values are kept', async () => {
    render(<EventForm timeZone="Europe/Paris" />);
    await fillEvent();
    await userEvent.clear(screen.getByLabelText('Heure de fin'));
    await userEvent.type(screen.getByLabelText('Heure de fin'), '07:00');
    await save();
    expect(await screen.findByText('La fin doit être après le début.')).toBeInTheDocument();
    expect(screen.getByLabelText('Titre')).toHaveValue('Course de ski');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[F-04 S1] RG-16: the event and its slot are sent in UTC, then the page of the event opens', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 7 }), { status: 201 }));
    render(<EventForm timeZone="Europe/Paris" />);
    await fillEvent();
    await userEvent.click(screen.getByRole('button', { name: '+ Ajouter un créneau' }));
    const dialog = screen.getByRole('dialog', { name: 'Ajouter un créneau' });
    await userEvent.type(within(dialog).getByLabelText('Début'), '08:00');
    await userEvent.type(within(dialog).getByLabelText('Fin'), '10:00');
    await userEvent.type(within(dialog).getByLabelText(/Limite/), '4');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Valider le créneau' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The slot form did not send the event form
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '14 mars, 08:00 – 10:00' })).toBeInTheDocument();

    await save();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/events/7'));
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe('/api/events');
    expect(JSON.parse(init.body)).toEqual({
      title: 'Course de ski',
      description: null,
      location: null,
      startsAt: '2027-03-14T07:00:00.000Z',
      endsAt: '2027-03-14T17:00:00.000Z',
      slots: [
        {
          startsAt: '2027-03-14T07:00:00.000Z',
          endsAt: '2027-03-14T09:00:00.000Z',
          capacity: 4,
          description: null,
        },
      ],
    });
  });
});
