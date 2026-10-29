import { useId } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SlotStatusTag } from '@/components/SlotStatusTag';
import type { FreeSlot } from '@/lib/api-types';
import { formatDay, formatPeriod, formatTime, toLocalParts } from '@/lib/dates';

type Variant = 'volunteer' | 'admin' | 'readonly';

/**
 * « 10:00 – 12:30 »; « 14 mars, 10:00 – 12:30 » on an event of several days; « 14 mars 22:00 → 15 mars 02:00 » for
 * a free slot over midnight (RG-16: in the club's zone).
 */
export function freeSlotHours(freeSlot: FreeSlot, timeZone: string, showDay = false): string {
  const { startsAt, endsAt } = freeSlot;
  if (toLocalParts(startsAt, timeZone).date !== toLocalParts(endsAt, timeZone).date)
    return formatPeriod(startsAt, endsAt, timeZone);
  const hours = `${formatTime(startsAt, timeZone)} – ${formatTime(endsAt, timeZone)}`;
  return showDay ? `${formatDay(startsAt, timeZone)}, ${hours}` : hours;
}

/** « Léa B. », « Léa B. (toi) », « ancien membre » (RG-09, RG-11). */
function nameOf(freeSlot: FreeSlot): string {
  const name = freeSlot.displayName ?? 'ancien membre';
  return freeSlot.isMe ? `${name} (toi)` : name;
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

interface Props {
  variant: Variant;
  freeSlots: FreeSlot[];
  timeZone: string;
  /** Shows the day with the hours: an event over several days. */
  showDay?: boolean;
  /** Under the title, in mode FREE only (B8): « Choisis les heures où tu es disponible. » */
  intro?: string;
  /** « Choisir mes horaires » (B9). Absent in `readonly`. */
  onChoose?: () => void;
  /** « Me désinscrire » on a free slot of the signed-in user, before its start (RG-08). */
  onUnregister?: (freeSlot: FreeSlot) => void;
  /** `admin`: the « × » of a free slot of somebody else, even started (RG-08). */
  onRemove?: (freeSlot: FreeSlot) => void;
}

/**
 * The free slots of an event (design/components.md, "FreeSlotList", F-22, RG-20): one row per free slot, « Prénom N. »
 * and hours, by start. No limit and no « Complet », ever. `volunteer` (B8): « Me désinscrire » on one's own rows
 * that have not started, « Choisir mes horaires » below. `admin` (C2): the same for the administrator's own rows,
 * plus « × » on the others. `readonly`: past event, no action (RG-15).
 */
export function FreeSlotList({
  variant,
  freeSlots,
  timeZone,
  showDay = false,
  intro,
  onChoose,
  onUnregister,
  onRemove,
}: Props) {
  const titleId = useId();
  const hasMine = freeSlots.some((freeSlot) => freeSlot.isMe);
  const title =
    variant === 'volunteer'
      ? 'Créneaux libres'
      : `Créneaux libres · ${plural(freeSlots.length, 'inscrit')}`;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-sm">
      <div className="flex flex-col gap-xs">
        <h2 id={titleId} className="text-large font-bold text-text">
          {title}
        </h2>
        {intro ? <p className="text-small text-text-muted">{intro}</p> : null}
      </div>

      {freeSlots.length === 0 ? (
        <p className="text-text-muted">
          {variant === 'volunteer'
            ? "Personne ne s'est encore inscrit. Choisis tes horaires."
            : 'Aucun inscrit pour le moment.'}
        </p>
      ) : (
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            {freeSlots.map((freeSlot) => {
              const hours = freeSlotHours(freeSlot, timeZone, showDay);
              const name = nameOf(freeSlot);
              const canUnregister =
                variant !== 'readonly' && freeSlot.isMe && !freeSlot.started && onUnregister;
              const canRemove = variant === 'admin' && !freeSlot.isMe && onRemove;
              return (
                <li
                  key={freeSlot.id}
                  className="flex flex-col gap-sm py-sm first:pt-none last:pb-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-sm gap-y-xs">
                    <div className="flex flex-col items-start gap-xs">
                      <span
                        className={
                          freeSlot.isMe
                            ? 'rounded-tag bg-primary px-sm text-on-primary'
                            : 'text-text'
                        }
                      >
                        {name}
                      </span>
                      {freeSlot.started ? (
                        <SlotStatusTag variant="neutral">Commencé</SlotStatusTag>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-xs">
                      <span className="font-bold text-text">{hours}</span>
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => onRemove(freeSlot)}
                          aria-label={`Retirer ${freeSlot.displayName ?? 'cet ancien membre'}, ${hours}`}
                          className="inline-flex h-avatar w-avatar items-center justify-center rounded-tag text-text hover:bg-surface"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {canUnregister ? (
                    <Button
                      variant="secondary"
                      onClick={() => onUnregister(freeSlot)}
                      aria-label={`Me désinscrire, ${hours}`}
                    >
                      Me désinscrire
                    </Button>
                  ) : null}
                  {variant === 'volunteer' && freeSlot.isMe && freeSlot.started ? (
                    <p className="text-small text-danger">
                      Contacte un administrateur pour modifier ton inscription
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {variant !== 'readonly' && onChoose ? (
        <Button variant={hasMine ? 'secondary' : 'primary'} onClick={onChoose}>
          Choisir mes horaires
        </Button>
      ) : null}
    </section>
  );
}
