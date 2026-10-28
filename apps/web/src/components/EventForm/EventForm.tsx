'use client';

import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { DateTimeRange } from '@/components/DateTimeRange';
import { Form } from '@/components/Form';
import { FormField } from '@/components/FormField';
import { TextInput, Textarea } from '@/components/Input';
import { SlotCard } from '@/components/SlotCard';
import { emptySlotForm, SlotForm } from '@/components/SlotForm';
import { patchJson, postJson, type ApiResult } from '@/lib/api-client';
import type { EventDetail } from '@/lib/api-types';
import { toInstant, toLocalParts } from '@/lib/dates';
import { eventFormSchema, type EventFormValues } from './event-form-schema';

interface Props {
  timeZone: string;
  /** Modification: the event as the API gives it. Its slots are managed on its page, not here. */
  event?: EventDetail;
}

// API field → field of this form
const fieldNames: Record<string, string> = {
  startsAt: 'dates.startDate',
  endsAt: 'dates.endDate',
};

function defaultValues(event: EventDetail | undefined, timeZone: string): EventFormValues {
  if (!event) {
    return {
      title: '',
      description: '',
      location: '',
      dates: { startDate: '', startTime: '', endDate: '', endTime: '' },
      slots: [],
    };
  }
  const start = toLocalParts(event.startsAt, timeZone);
  const end = toLocalParts(event.endsAt, timeZone);
  return {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    dates: { startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time },
    slots: [],
  };
}

/** Optional slots of a new event (F-04): added through the slot form, listed as cards, removable before saving. */
function NewSlots({ timeZone }: { timeZone: string }) {
  const { control, getValues } = useFormContext<EventFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'slots' });
  const [adding, setAdding] = useState(false);
  const dates = adding ? getValues('dates') : null;

  return (
    <section aria-labelledby="new-slots" className="flex flex-col gap-sm">
      <h2 id="new-slots" className="text-small text-text-muted">
        Créneaux (facultatif)
      </h2>
      {fields.map((slot, index) => (
        <SlotCard
          key={slot.id}
          variant="admin"
          slot={{ ...slot, registeredCount: 0 }}
          timeZone={timeZone}
          showDay
          deleteLabel="Retirer"
          onDelete={() => remove(index)}
        />
      ))}
      <Button variant="secondary" onClick={() => setAdding(true)}>
        + Ajouter un créneau
      </Button>
      {dates ? (
        <SlotForm
          title="Ajouter un créneau"
          timeZone={timeZone}
          event={{
            startsAt: toInstant(dates.startDate, dates.startTime, timeZone),
            endsAt: toInstant(dates.endDate, dates.endTime, timeZone),
          }}
          defaultValues={emptySlotForm(dates.startDate)}
          onClose={() => setAdding(false)}
          onSubmit={async (slot) => {
            append(slot);
            return { ok: true, data: undefined };
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * C4, C5 (F-04, RG-06, RG-16): creation with optional slots, or modification of an existing event (`event`).
 * The registrations are kept on modification. After saving, the administrator lands on the page of the event.
 */
export function EventForm({ timeZone, event }: Props) {
  const router = useRouter();

  async function save(values: EventFormValues): Promise<ApiResult> {
    const { dates } = values;
    const body = {
      title: values.title,
      description: values.description.trim() || null,
      location: values.location.trim() || null,
      startsAt: toInstant(dates.startDate, dates.startTime, timeZone),
      endsAt: toInstant(dates.endDate, dates.endTime, timeZone),
    };
    const result = event
      ? await patchJson<EventDetail>(`/api/events/${event.id}`, body)
      : await postJson<EventDetail>('/api/events', { ...body, slots: values.slots });

    if (result.ok) {
      router.push(`/events/${result.data.id}`);
      router.refresh();
      return result;
    }
    const fields = result.error.details?.fields?.map(({ field, code }) => ({
      field: fieldNames[field] ?? field,
      code,
    }));
    return fields ? { ok: false, error: { ...result.error, details: { fields } } } : result;
  }

  return (
    <Form
      schema={eventFormSchema}
      defaultValues={defaultValues(event, timeZone)}
      submitLabel="Enregistrer"
      onSubmit={(values) => save(values as EventFormValues)}
    >
      <FormField
        name="title"
        label="Titre"
        required
        messages={{ FIELD_REQUIRED: 'Le titre est obligatoire.' }}
      >
        <TextInput />
      </FormField>
      <FormField name="description" label="Description">
        <Textarea />
      </FormField>
      <FormField name="location" label="Lieu">
        <TextInput />
      </FormField>
      <DateTimeRange name="dates" legend="Dates de l'événement" />
      {event ? null : <NewSlots timeZone={timeZone} />}
    </Form>
  );
}
