'use client';

import { useId } from 'react';
import { get, useFormContext } from 'react-hook-form';
import { FieldError } from '@/components/FieldError';
import { FormField, fieldMessage } from '@/components/FormField';
import { DateInput, TimeInput } from '@/components/Input';

interface Props {
  /**
   * Prefix of the four fields in the form values: `startDate`, `startTime`, `endDate`, `endTime`. The form schema
   * reports "la fin doit être après le début" (RG-06) on `endDate` or `endTime`; both end fields then turn red.
   */
  name: string;
  legend?: string;
}

/**
 * One row of the group: the day and the time side by side, even at 360 px (C4, B9), with the message of either
 * field under the row, linked to both.
 */
function DayAndTime({ day, time, which }: { day: string; time: string; which: 'début' | 'fin' }) {
  const { formState } = useFormContext();
  const messageId = useId();
  const codeOf = (field: string) =>
    (get(formState.errors, field) as { message?: string } | undefined)?.message;
  const code = codeOf(day) ?? codeOf(time);
  return (
    <div className="flex flex-col gap-xs">
      <div className="grid grid-cols-2 gap-sm">
        <div>
          <FormField
            name={day}
            label={`Date de ${which}`}
            required
            invalid={Boolean(code)}
            messageId={messageId}
          >
            <DateInput />
          </FormField>
        </div>
        <div>
          <FormField
            name={time}
            label={`Heure de ${which}`}
            required
            invalid={Boolean(code)}
            messageId={messageId}
          >
            <TimeInput />
          </FormField>
        </div>
      </div>
      {code ? <FieldError id={messageId}>{fieldMessage(code)}</FieldError> : null}
    </div>
  );
}

/** "Début / fin" group (day + time) for an event or a free slot, built from `FormField`s (design/components.md). */
export function DateTimeRange({ name, legend }: Props) {
  const path = (field: string) => (name ? `${name}.${field}` : field);
  return (
    <fieldset className="flex flex-col gap-md">
      {legend ? <legend className="mb-sm font-medium text-text">{legend}</legend> : null}
      <DayAndTime day={path('startDate')} time={path('startTime')} which="début" />
      <DayAndTime day={path('endDate')} time={path('endTime')} which="fin" />
    </fieldset>
  );
}
