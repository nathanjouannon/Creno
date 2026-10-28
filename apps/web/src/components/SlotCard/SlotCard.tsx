import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SlotStatusTag } from '@/components/SlotStatusTag';
import { formatDay, formatTime } from '@/lib/dates';

type Variant = 'admin' | 'readonly';

interface Props {
  variant: Variant;
  slot: { startsAt: string; endsAt: string; capacity: number | null; registeredCount: number };
  timeZone: string;
  /** Shows the day too: slots of several days, or slots being added to a new event. */
  showDay?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Label of the delete button (« Retirer » for a slot not saved yet). */
  deleteLabel?: string;
}

/**
 * One slot (design/components.md, "SlotCard"). `admin`: counter, then Modifier and Supprimer (C2, F-05).
 * `readonly`: past event, no action at all (RG-15). The attendees and the volunteer actions come with T-015 and T-016.
 */
export function SlotCard({
  variant,
  slot,
  timeZone,
  showDay,
  onEdit,
  onDelete,
  deleteLabel = 'Supprimer',
}: Props) {
  const hours = `${formatTime(slot.startsAt, timeZone)} – ${formatTime(slot.endsAt, timeZone)}`;
  const heading = showDay ? `${formatDay(slot.startsAt, timeZone)}, ${hours}` : hours;
  const actions = variant === 'admin' && (onEdit || onDelete);

  return (
    <Card>
      <div className="flex flex-col gap-sm">
        <div className="flex items-start justify-between gap-sm">
          <h3 className="font-bold text-text">{heading}</h3>
          <SlotStatusTag
            variant="counter"
            capacity={slot.capacity}
            registeredCount={slot.registeredCount}
          />
        </div>
        {actions ? (
          <div className="flex gap-sm">
            {onEdit ? (
              <Button
                variant="secondary"
                size="inline"
                onClick={onEdit}
                aria-label={`Modifier le créneau ${heading}`}
              >
                Modifier
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                variant="secondary"
                size="inline"
                onClick={onDelete}
                aria-label={`${deleteLabel} le créneau ${heading}`}
              >
                {deleteLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
