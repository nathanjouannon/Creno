import { z } from 'zod';
import type { SlotValues } from '@/components/SlotForm';

const day = () => z.string().min(1, 'FIELD_DATE_INVALID');

// The values of the event form, typed in the club's zone (RG-16). The server checks again (eventInputSchema).
// Messages are field codes (ADR-0009).
export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, 'FIELD_REQUIRED'),
    description: z.string(),
    location: z.string(),
    dates: z.object({ startDate: day(), startTime: day(), endDate: day(), endTime: day() }),
    // RG-19: « Créneaux fixes » by default
    registrationMode: z.enum(['FIXED', 'FREE', 'BOTH'], {
      error: 'FIELD_REGISTRATION_MODE_INVALID',
    }),
    // Slots already checked by the slot form (RG-07)
    slots: z.array(z.custom<SlotValues>()),
  })
  .superRefine(({ dates }, context) => {
    const start = `${dates.startDate}T${dates.startTime}`;
    const end = `${dates.endDate}T${dates.endTime}`;
    // RG-06: the end comes after the start (same zone, so the local texts compare like the instants)
    if (dates.startDate && dates.startTime && dates.endDate && dates.endTime && end <= start) {
      context.addIssue({
        code: 'custom',
        path: ['dates', 'endDate'],
        message: 'FIELD_END_NOT_AFTER_START',
      });
    }
  });

export type EventFormValues = z.input<typeof eventFormSchema>;
