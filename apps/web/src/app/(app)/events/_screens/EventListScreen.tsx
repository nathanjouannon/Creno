'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { EventListItem } from '@/components/EventListItem';
import { PageTitle } from '@/components/PageTitle';
import type { Club, EventSummary } from '@/lib/api-types';
import { useApi } from '@/lib/use-api';
import { both, ScreenState } from './ScreenState';

interface Props {
  scope: 'upcoming' | 'past';
  isAdmin: boolean;
}

const texts = {
  upcoming: { title: 'Événements à venir', empty: 'Aucun événement à venir pour le moment.' },
  past: { title: 'Événements passés', empty: 'Aucun événement passé.' },
};

/** C1 and B1 (upcoming, by start), C9 (past, administrators only, most recent first: RG-09). */
export function EventListScreen({ scope, isAdmin }: Props) {
  const router = useRouter();
  const events = useApi<EventSummary[]>(`/api/events?scope=${scope}`);
  const club = useApi<Club>('/api/club');

  return (
    <div className="flex flex-col gap-md">
      <PageTitle>{texts[scope].title}</PageTitle>
      {isAdmin && scope === 'upcoming' ? (
        <Button variant="primary" onClick={() => router.push('/events/new')}>
          + Créer un événement
        </Button>
      ) : null}
      <ScreenState state={both(events, club)}>
        {([list, { timezone }]) =>
          list.length === 0 ? (
            <EmptyState>{texts[scope].empty}</EmptyState>
          ) : (
            <ul className="flex flex-col gap-md">
              {list.map((event) => (
                <li key={event.id}>
                  <EventListItem variant={scope} event={event} timeZone={timezone} />
                </li>
              ))}
            </ul>
          )
        }
      </ScreenState>
    </div>
  );
}
