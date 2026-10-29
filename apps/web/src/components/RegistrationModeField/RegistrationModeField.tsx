'use client';

import { useId } from 'react';
import { get, useFormContext } from 'react-hook-form';
import { FieldError } from '@/components/FieldError';
import { fieldMessage } from '@/components/FormField';
import { useFormSending } from '@/components/Form';
import type { RegistrationMode } from '@/lib/api-types';
import { registrationModeLabels } from './labels';

const options: { value: RegistrationMode; help: string }[] = [
  { value: 'FIXED', help: "Tu définis les créneaux, les bénévoles s'y inscrivent." },
  { value: 'FREE', help: 'Chaque bénévole choisit ses heures de début et de fin.' },
  { value: 'BOTH', help: 'Tes créneaux sont proposés, et chacun peut aussi choisir ses heures.' },
];

interface Props {
  /** Field name in the form values. */
  name: string;
  /** Fixed slots of the event (saved, or about to be created with it). */
  slotCount: number;
  /** Free slots of the event. */
  freeSlotCount: number;
}

/**
 * « Inscriptions » (design/components.md, "RegistrationModeField", C4, C11): three radio buttons, each with its
 * help. RG-19: an option the content of the event forbids is disabled, with its reason in text; the server stays
 * the authority (RG-14), this only spares a refusal.
 */
export function RegistrationModeField({ name, slotCount, freeSlotCount }: Props) {
  const { register, formState } = useFormContext();
  const sending = useFormSending();
  const id = useId();
  const code = (get(formState.errors, name) as { message?: string } | undefined)?.message;

  function reason(mode: RegistrationMode): string | null {
    if (mode === 'FREE' && slotCount > 0)
      return `Supprime d'abord les créneaux fixes (${slotCount}).`;
    if (mode === 'FIXED' && freeSlotCount > 0)
      return `Supprime d'abord les créneaux libres (${freeSlotCount}).`;
    return null;
  }

  return (
    <fieldset className="flex flex-col gap-sm" aria-describedby={code ? `${id}-error` : undefined}>
      <legend className="mb-sm text-small text-text-muted">Inscriptions</legend>
      {options.map(({ value, help }) => {
        const why = reason(value);
        const optionId = `${id}-${value}`;
        return (
          <div key={value} className="flex items-start gap-sm">
            <input
              type="radio"
              id={optionId}
              value={value}
              disabled={sending || Boolean(why)}
              aria-describedby={[`${optionId}-help`, why ? `${optionId}-why` : null]
                .filter(Boolean)
                .join(' ')}
              className="mt-xs h-icon w-icon shrink-0 accent-primary"
              {...register(name)}
            />
            <div className="flex min-w-none flex-col gap-xs">
              <label htmlFor={optionId} className={why ? 'text-text-muted' : 'text-text'}>
                {registrationModeLabels[value]}
              </label>
              <p id={`${optionId}-help`} className="text-small text-text-muted">
                {help}
              </p>
              {why ? (
                <p
                  id={`${optionId}-why`}
                  className="self-start rounded-tag bg-warning-surface px-sm text-small text-text"
                >
                  {why}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
      {code ? <FieldError id={`${id}-error`}>{fieldMessage(code)}</FieldError> : null}
    </fieldset>
  );
}
