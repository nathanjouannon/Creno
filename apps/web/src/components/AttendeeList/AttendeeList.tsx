import type { Slot } from '@/lib/api-types';

type Attendee = Slot['attendees'][number];

// design/components.md, "AttendeeList / AttendeeChip": `me` is filled with the primary colour, the text says it too
const chipClasses = {
  default: 'bg-surface text-text',
  me: 'bg-primary text-on-primary',
};

/** « Marie D. », « Alex M. (toi) », « ancien membre » for an anonymised registration (RG-09, RG-11). */
export function attendeeLabel(attendee: Attendee): string {
  const name = attendee.displayName ?? 'ancien membre';
  return attendee.isMe ? `${name} (toi)` : name;
}

interface Props {
  attendees: Attendee[];
  /** `removable` chips (administrator view, RG-08): a « × » per attendee, named after the person and the slot. */
  onRemove?: (attendee: Attendee) => void;
  slotLabel?: string;
}

/** Who is registered to a slot, visible to every user (RG-09). Renders nothing for an empty slot. */
export function AttendeeList({ attendees, onRemove, slotLabel = '' }: Props) {
  if (attendees.length === 0) return null;
  return (
    <ul aria-label="Inscrits" className="flex flex-wrap gap-x-sm gap-y-xs">
      {attendees.map((attendee) => (
        <li
          key={attendee.registrationId}
          className={`inline-flex items-center rounded-tag px-sm text-small ${chipClasses[attendee.isMe ? 'me' : 'default']}`}
        >
          {attendeeLabel(attendee)}
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(attendee)}
              aria-label={`Retirer ${attendee.displayName ?? 'cet ancien membre'} du créneau ${slotLabel}`}
              className="ml-xs inline-flex h-avatar w-avatar items-center justify-center rounded-tag"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
