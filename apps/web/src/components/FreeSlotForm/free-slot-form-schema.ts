import { FREE_SLOT_MIN_MINUTES } from '@creno/validation';
import { z } from 'zod';

const part = () => z.string().min(1, 'FIELD_DATE_INVALID');

/** Minutes between two local date-times of the same zone (enough to spare a round trip; the server decides). */
const minutesBetween = (start: string, end: string) =>
  (Date.parse(`${end}:00Z`) - Date.parse(`${start}:00Z`)) / 60_000;

// The values of « Choisir mes horaires » (B9): two days and two times in the club's zone (RG-16). The server checks
// again (freeSlotInputSchema, then the service for the dates of the event and the current time, RG-20).
// Messages are field codes (ADR-0009).
export const freeSlotFormSchema = z
  .object({ startDate: part(), startTime: part(), endDate: part(), endTime: part() })
  .superRefine((values, context) => {
    if (!values.startDate || !values.startTime || !values.endDate || !values.endTime) return;
    const minutes = minutesBetween(
      `${values.startDate}T${values.startTime}`,
      `${values.endDate}T${values.endTime}`,
    );
    if (Number.isNaN(minutes)) return;
    // RG-20: the end comes after the start, 30 minutes later at least
    if (minutes <= 0 || minutes < FREE_SLOT_MIN_MINUTES) {
      context.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: minutes <= 0 ? 'FIELD_END_NOT_AFTER_START' : 'FIELD_FREE_SLOT_TOO_SHORT',
      });
    }
  });

export type FreeSlotFormValues = z.input<typeof freeSlotFormSchema>;
