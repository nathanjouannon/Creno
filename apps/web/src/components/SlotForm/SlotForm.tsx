'use client';

import { useWatch } from 'react-hook-form';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Modal } from '@/components/ConfirmDialog';
import { Form } from '@/components/Form';
import { FormField } from '@/components/FormField';
import { DateInput, NumberInput, TimeInput } from '@/components/Input';
import type { ApiResult } from '@/lib/api-client';
import { toInstant } from '@/lib/dates';
import { slotFormSchema, type SlotFormValues } from './slot-form-schema';

/** What the API takes for a slot (`SlotInput`). */
export interface SlotValues {
  startsAt: string;
  endsAt: string;
  capacity: number | null;
}

interface Props {
  /** « Ajouter un créneau » (C6) or « Modifier le créneau » (C7). */
  title: string;
  onClose: () => void;
  timeZone: string;
  /** Dates of the event, for the warning; null while the event form has none yet. */
  event: { startsAt: string | null; endsAt: string | null };
  defaultValues: SlotFormValues;
  /** Saves the slot; the window closes on success. */
  onSubmit: (slot: SlotValues) => Promise<ApiResult>;
}

// API field → field of this form
const fieldNames: Record<string, string> = {
  startsAt: 'startTime',
  endsAt: 'endTime',
  capacity: 'capacity',
};

function toSlotValues(values: SlotFormValues, timeZone: string): SlotValues | null {
  const startsAt = toInstant(values.date, values.startTime, timeZone);
  const endsAt = toInstant(values.date, values.endTime, timeZone);
  if (!startsAt || !endsAt) return null;
  const capacity = values.capacity.trim();
  return { startsAt, endsAt, capacity: capacity === '' ? null : Number(capacity) };
}

/** RG-07: a slot may be outside the dates of its event; the administrator is warned but can validate. */
function OutOfEventWarning({ timeZone, event }: Pick<Props, 'timeZone' | 'event'>) {
  const values = useWatch() as SlotFormValues;
  const slot = toSlotValues(values, timeZone);
  if (!slot || !event.startsAt || !event.endsAt) return null;
  if (slot.startsAt >= event.startsAt && slot.endsAt <= event.endsAt) return null;
  return (
    <Alert variant="warning">
      Ce créneau est hors des dates de l&apos;événement. Tu peux quand même le valider.
    </Alert>
  );
}

/**
 * C6, C7 (F-05, RG-07): day, start, end, optional limit, in a window opened from the event form or the event page,
 * so never inside another form in the HTML. A limit under the registrations is refused by the server, under the
 * limit field.
 */
export function SlotForm({ title, onClose, timeZone, event, defaultValues, onSubmit }: Props) {
  return (
    <Modal title={title} onClose={onClose}>
      <Form
        schema={slotFormSchema}
        defaultValues={defaultValues}
        submitLabel="Valider le créneau"
        errorMap={{ SLOT_CAPACITY_BELOW_REGISTRATIONS: { field: 'capacity' } }}
        onSubmit={async (values) => {
          const slot = toSlotValues(values as SlotFormValues, timeZone);
          if (!slot) {
            return {
              ok: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: '',
                details: { fields: [{ field: 'date', code: 'FIELD_DATE_INVALID' }] },
              },
            };
          }
          const result = await onSubmit(slot);
          if (result.ok) onClose();
          if (result.ok || !result.error.details?.fields) return result;
          // The server names its fields after the API; show them under the fields of this form
          const fields = result.error.details.fields.map(({ field, code }) => ({
            field: fieldNames[field] ?? field,
            code,
          }));
          return { ok: false, error: { ...result.error, details: { fields } } };
        }}
      >
        <FormField name="date" label="Date" required>
          <DateInput />
        </FormField>
        <FormField name="startTime" label="Début" required>
          <TimeInput />
        </FormField>
        <FormField name="endTime" label="Fin" required>
          <TimeInput />
        </FormField>
        <FormField name="capacity" label="Limite de places (vide = illimité)">
          <NumberInput />
        </FormField>
        <OutOfEventWarning timeZone={timeZone} event={event} />
      </Form>
      <Button variant="secondary" size="block" onClick={onClose}>
        Annuler
      </Button>
    </Modal>
  );
}
