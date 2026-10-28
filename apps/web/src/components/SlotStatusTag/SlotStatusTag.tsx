import type { ReactNode } from 'react';

type Props =
  | { variant: 'counter'; capacity: number | null; registeredCount: number }
  | { variant: 'neutral' | 'success' | 'danger'; children: ReactNode };

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

// design/components.md, "SlotStatusTag": the border and the text colour carry the variant (contrast checked by packages/tokens), the text always says it too
const toneClasses = {
  counter: 'border-border text-text-muted',
  neutral: 'border-border text-text-muted',
  success: 'border-success text-success',
  danger: 'border-danger bg-danger-surface text-danger',
};

/**
 * Tag at the top right of a slot (design/components.md, "SlotStatusTag"). `counter`, the administrator's: « 3 / 4 »
 * for a limited slot, « 5 inscrits » for an unlimited one (RG-07). `neutral`, `success` and `danger`, the volunteer's:
 * the text is given by the caller. The text always carries the meaning.
 */
export function SlotStatusTag(props: Props) {
  let text: ReactNode;
  let label: string | undefined;
  if (props.variant === 'counter') {
    const { capacity, registeredCount } = props;
    text =
      capacity === null ? plural(registeredCount, 'inscrit') : `${registeredCount} / ${capacity}`;
    label =
      capacity === null
        ? `${plural(registeredCount, 'inscrit')}, sans limite`
        : `${plural(registeredCount, 'inscrit')} sur ${plural(capacity, 'place')}`;
  } else {
    text = props.children;
  }
  return (
    <span
      aria-label={label}
      className={`shrink-0 rounded-tag border px-sm text-small font-medium ${toneClasses[props.variant]}`}
    >
      {text}
    </span>
  );
}
