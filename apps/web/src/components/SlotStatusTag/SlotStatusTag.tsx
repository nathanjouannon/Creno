type Variant = 'counter';

interface Props {
  variant: Variant;
  capacity: number | null;
  registeredCount: number;
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

/**
 * Tag at the top right of a slot (design/components.md, "SlotStatusTag"). `counter`, the administrator's: « 3 / 4 »
 * for a limited slot, « 5 inscrits » for an unlimited one (RG-07). The text always carries the meaning.
 */
export function SlotStatusTag({ capacity, registeredCount }: Props) {
  const text =
    capacity === null ? plural(registeredCount, 'inscrit') : `${registeredCount} / ${capacity}`;
  const label =
    capacity === null
      ? `${plural(registeredCount, 'inscrit')}, sans limite`
      : `${plural(registeredCount, 'inscrit')} sur ${plural(capacity, 'place')}`;
  return (
    <span
      aria-label={label}
      className="shrink-0 rounded-tag border border-border px-sm text-small font-medium text-text-muted"
    >
      {text}
    </span>
  );
}
