'use client';

import { get, useFormContext } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { DateInput, TimeInput } from '@/components/Input';

interface Props {
  /**
   * Prefix of the four fields in the form values: `startDate`, `startTime`, `endDate`, `endTime`. The form schema
   * reports "la fin doit être après le début" (RG-06) on `endDate`; both end fields then turn red.
   */
  name: string;
  legend?: string;
}

/** "Début / fin" group (day + time) for an event or a slot, built from `FormField`s (design/components.md). */
export function DateTimeRange({ name, legend }: Props) {
  const { formState } = useFormContext();
  const path = (field: string) => (name ? `${name}.${field}` : field);
  const endInvalid = Boolean(
    get(formState.errors, path('endDate')) || get(formState.errors, path('endTime')),
  );

  return (
    <fieldset className="flex flex-col gap-md">
      {legend ? <legend className="mb-sm font-medium text-text">{legend}</legend> : null}
      <div className="flex flex-col gap-sm desktop:flex-row">
        <div className="flex-1">
          <FormField name={path('startDate')} label="Date de début" required>
            <DateInput />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField name={path('startTime')} label="Heure de début" required>
            <TimeInput />
          </FormField>
        </div>
      </div>
      <div className="flex flex-col gap-sm desktop:flex-row">
        <div className="flex-1">
          <FormField name={path('endDate')} label="Date de fin" required invalid={endInvalid}>
            <DateInput />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField name={path('endTime')} label="Heure de fin" required invalid={endInvalid}>
            <TimeInput />
          </FormField>
        </div>
      </div>
    </fieldset>
  );
}
