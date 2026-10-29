'use client';

import { Modal } from '@/components/ConfirmDialog';
import { DateTimeRange } from '@/components/DateTimeRange';
import { Form } from '@/components/Form';
import type { ApiResult } from '@/lib/api-client';
import { formatPeriod, toInstant, toLocalParts } from '@/lib/dates';
import { freeSlotFormSchema, type FreeSlotFormValues } from './free-slot-form-schema';

/** What the API takes for a free slot (`FreeSlotInput`). */
export interface FreeSlotValues {
  startsAt: string;
  endsAt: string;
}

interface Props {
  /** Dates of the event: shown under the title and used to prefill the fields. */
  event: { startsAt: string; endsAt: string };
  timeZone: string;
  onClose: () => void;
  /** Saves the free slot; the window closes on success. */
  onSubmit: (values: FreeSlotValues) => Promise<ApiResult>;
}

// API field → field of this form: errors on the start go under its time, errors on the end under its time
const fieldNames: Record<string, string> = { startsAt: 'startTime', endsAt: 'endTime' };

function prefilled(event: Props['event'], timeZone: string): FreeSlotFormValues {
  const start = toLocalParts(event.startsAt, timeZone);
  const end = toLocalParts(event.endsAt, timeZone);
  return { startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time };
}

/**
 * « Choisir mes horaires » (B9, B9 bis; F-22, RG-20): a start and an end, prefilled with the dates of the event, in a
 * window. Errors of the dates of the event, of the length, of the start and of the order go under the fields; an
 * overlap with one's other free slots goes in an alert at the top. What was typed is kept on error.
 */
export function FreeSlotForm({ event, timeZone, onClose, onSubmit }: Props) {
  return (
    <Modal title="Choisir mes horaires" onClose={onClose}>
      <p className="text-small text-text-muted">
        Événement : {formatPeriod(event.startsAt, event.endsAt, timeZone)}
      </p>
      <Form
        schema={freeSlotFormSchema}
        defaultValues={prefilled(event, timeZone)}
        submitLabel="Enregistrer"
        onCancel={onClose}
        onSubmit={async (values) => {
          const typed = values as FreeSlotFormValues;
          const startsAt = toInstant(typed.startDate, typed.startTime, timeZone);
          const endsAt = toInstant(typed.endDate, typed.endTime, timeZone);
          if (!startsAt || !endsAt) {
            return {
              ok: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: '',
                details: { fields: [{ field: 'startDate', code: 'FIELD_DATE_INVALID' }] },
              },
            };
          }
          const result = await onSubmit({ startsAt, endsAt });
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
        <DateTimeRange name="" />
      </Form>
    </Modal>
  );
}
