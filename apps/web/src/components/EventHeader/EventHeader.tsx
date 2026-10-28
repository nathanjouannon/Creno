import { errorCatalog } from '@creno/validation';
import type { ReactNode } from 'react';
import { formatPeriod } from '@/lib/dates';
import type { EventDetail } from '@/lib/api-types';

type Variant = 'volunteer' | 'admin' | 'past';

interface Props {
  variant: Variant;
  event: Pick<EventDetail, 'title' | 'location' | 'description' | 'startsAt' | 'endsAt'>;
  timeZone: string;
  /** `admin` only: the buttons Modifier and Supprimer. */
  actions?: ReactNode;
}

/** Title, place, dates and description of an event (C2). `past`: no button, read only (RG-15). */
export function EventHeader({ variant, event, timeZone, actions }: Props) {
  return (
    <header className="flex flex-col gap-sm">
      <h1 className="text-title font-bold text-text">{event.title}</h1>
      <p className="text-small text-text-muted">
        {[event.location, formatPeriod(event.startsAt, event.endsAt, timeZone)]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {variant === 'past' ? (
        <p className="text-small text-text-muted">{errorCatalog.EVENT_PAST.message}</p>
      ) : null}
      {event.description ? <p className="text-text">{event.description}</p> : null}
      {variant === 'admin' && actions ? (
        <div className="flex flex-wrap gap-sm">{actions}</div>
      ) : null}
    </header>
  );
}
