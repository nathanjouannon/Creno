import { Card } from '@/components/Card';
import { formatDay, formatDayTime } from '@/lib/dates';
import type { EventSummary } from '@/lib/api-types';

type Variant = 'upcoming' | 'past';

interface Props {
  variant: Variant;
  event: EventSummary;
  timeZone: string;
}

/** An event of a list (C1, C9): title, then « lieu · 14 mars, 08:00 », or « lieu · 12 décembre, terminé ». */
export function EventListItem({ variant, event, timeZone }: Props) {
  const when =
    variant === 'past'
      ? `${formatDay(event.startsAt, timeZone)}, terminé`
      : formatDayTime(event.startsAt, timeZone);
  return (
    <Card href={`/events/${event.id}`}>
      <p className="font-medium text-text">{event.title}</p>
      <p className="text-small text-text-muted">
        {[event.location, when].filter(Boolean).join(' · ')}
      </p>
    </Card>
  );
}
