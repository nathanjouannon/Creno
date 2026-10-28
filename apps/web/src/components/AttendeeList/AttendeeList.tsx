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

/** Who is registered to a slot, visible to every user (RG-09). Renders nothing for an empty slot. */
export function AttendeeList({ attendees }: { attendees: Attendee[] }) {
  if (attendees.length === 0) return null;
  return (
    <ul aria-label="Inscrits" className="flex flex-wrap gap-x-sm gap-y-xs">
      {attendees.map((attendee) => (
        <li
          key={attendee.registrationId}
          className={`rounded-tag px-sm text-small ${chipClasses[attendee.isMe ? 'me' : 'default']}`}
        >
          {attendeeLabel(attendee)}
        </li>
      ))}
    </ul>
  );
}
