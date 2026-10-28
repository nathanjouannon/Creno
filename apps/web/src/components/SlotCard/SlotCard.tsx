import { AttendeeList } from '@/components/AttendeeList';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SlotStatusTag } from '@/components/SlotStatusTag';
import type { Slot } from '@/lib/api-types';
import { formatDay, formatTime } from '@/lib/dates';

type Variant = 'volunteer' | 'admin' | 'readonly';

type SlotSource = Pick<Slot, 'startsAt' | 'endsAt' | 'capacity' | 'registeredCount'> &
  Partial<Pick<Slot, 'started' | 'full' | 'remainingPlaces' | 'attendees'>>;

interface Props {
  variant: Variant;
  slot: SlotSource;
  timeZone: string;
  /** Shows the day too: slots of several days, or slots being added to a new event. */
  showDay?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Label of the delete button (« Retirer » for a slot not saved yet). */
  deleteLabel?: string;
  /** `volunteer`, and `admin` with the same rules (RG-08): the registration of the signed-in user. */
  onRegister?: () => void;
  onUnregister?: () => void;
  /** A registration or a cancellation is under way: the button keeps its label and is blocked. */
  loading?: boolean;
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

/** The tag of the volunteer states of design/components.md: `registered`, `started`, `full`, `open`. */
function VolunteerTag({ slot, mine }: { slot: SlotSource; mine: boolean }) {
  if (slot.started) {
    return (
      <SlotStatusTag variant="neutral">{mine ? 'Commencé · inscrit' : 'Commencé'}</SlotStatusTag>
    );
  }
  if (mine) return <SlotStatusTag variant="success">Inscrit</SlotStatusTag>;
  if (slot.full) return <SlotStatusTag variant="danger">Complet</SlotStatusTag>;
  return (
    <SlotStatusTag variant="neutral">
      {slot.remainingPlaces === null || slot.remainingPlaces === undefined
        ? 'Sans limite'
        : plural(slot.remainingPlaces, 'place') +
          (slot.remainingPlaces > 1 ? ' restantes' : ' restante')}
    </SlotStatusTag>
  );
}

/**
 * One slot (design/components.md, "SlotCard"). `volunteer`: tag of the state, attendees and one action, « Je m'inscris »
 * or « Me désinscrire » (B3, B4, F-07, F-08). `admin`: counter, then Modifier and Supprimer (C2, F-05); given the
 * registration handlers, it also carries the volunteer zone, as an administrator registers like any user (RG-08).
 * `readonly`: past event, no action at all (RG-15).
 */
export function SlotCard({
  variant,
  slot,
  timeZone,
  showDay,
  onEdit,
  onDelete,
  deleteLabel = 'Supprimer',
  onRegister,
  onUnregister,
  loading = false,
}: Props) {
  const hours = `${formatTime(slot.startsAt, timeZone)} – ${formatTime(slot.endsAt, timeZone)}`;
  const heading = showDay ? `${formatDay(slot.startsAt, timeZone)}, ${hours}` : hours;
  const actions = variant === 'admin' && (onEdit || onDelete);
  const attendees = slot.attendees ?? [];
  const mine = attendees.some((attendee) => attendee.isMe);
  const volunteerZone = variant === 'volunteer' || (variant === 'admin' && Boolean(slot.attendees));
  // RG-08: a started slot takes no registration and no cancellation; an administrator removes through C2 (T-016)
  const startedMessage =
    volunteerZone && slot.started
      ? !mine
        ? 'Ce créneau a commencé : inscription impossible'
        : variant === 'volunteer'
          ? 'Contacte un administrateur pour modifier ton inscription'
          : null
      : null;

  return (
    <Card variant={volunteerZone && mine ? 'selected' : 'default'}>
      <div className="flex flex-col gap-sm">
        <div className="flex items-start justify-between gap-sm">
          <h3 className="font-bold text-text">{heading}</h3>
          {variant === 'volunteer' ? (
            <VolunteerTag slot={slot} mine={mine} />
          ) : (
            <SlotStatusTag
              variant="counter"
              capacity={slot.capacity}
              registeredCount={slot.registeredCount}
            />
          )}
        </div>
        {volunteerZone ? <AttendeeList attendees={attendees} /> : null}
        {startedMessage ? <p className="text-small text-danger">{startedMessage}</p> : null}
        {volunteerZone && !slot.started ? (
          mine ? (
            <Button
              variant="secondary"
              loading={loading}
              onClick={onUnregister}
              aria-label={`Me désinscrire du créneau ${heading}`}
            >
              Me désinscrire
            </Button>
          ) : slot.full ? (
            <Button variant="secondary" disabled aria-label={`Complet : créneau ${heading}`}>
              Complet
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={loading}
              onClick={onRegister}
              aria-label={`Je m'inscris au créneau ${heading}`}
            >
              Je m'inscris
            </Button>
          )
        ) : null}
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
