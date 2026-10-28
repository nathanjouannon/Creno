'use client';

import { errorCatalog } from '@creno/validation';
import { Alert } from '@/components/Alert';
import { EventForm } from '@/components/EventForm';
import { PageTitle } from '@/components/PageTitle';
import type { Club, EventDetail } from '@/lib/api-types';
import { useApi, type ApiState } from '@/lib/use-api';
import { both, ScreenState } from './ScreenState';

const noEvent: ApiState<null> = { status: 'ready', data: null };

function EditedEvent({ eventId, club }: { eventId: string; club: ApiState<Club> }) {
  const event = useApi<EventDetail>(`/api/events/${eventId}`);
  return (
    <ScreenState state={both(event, club)}>
      {([detail, { timezone }]) =>
        // RG-15: a past event is read only
        detail.status === 'past' ? (
          <Alert>{errorCatalog.EVENT_PAST.message}</Alert>
        ) : (
          <EventForm timeZone={timezone} event={detail} />
        )
      }
    </ScreenState>
  );
}

/** C4, C5: creation, or modification when `eventId` is given. Dates are typed in the club's zone (RG-16). */
export function EventFormScreen({ eventId }: { eventId?: string }) {
  const club = useApi<Club>('/api/club');

  return (
    <div className="flex flex-col gap-md">
      <PageTitle>{eventId ? "Modifier l'événement" : 'Créer un événement'}</PageTitle>
      {eventId ? (
        <EditedEvent eventId={eventId} club={club} />
      ) : (
        <ScreenState state={both(noEvent, club)}>
          {([, { timezone }]) => <EventForm timeZone={timezone} />}
        </ScreenState>
      )}
    </div>
  );
}
