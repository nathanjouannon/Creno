import { z } from 'zod';

// The values of the slot form: a day and two times in the club's zone (RG-16), the limit as typed (empty = unlimited).
// The server checks again (slotInputSchema); here it only spares a round trip. Messages are field codes (ADR-0009).
export const slotFormSchema = z
  .object({
    date: z.string().min(1, 'FIELD_DATE_INVALID'),
    startTime: z.string().min(1, 'FIELD_DATE_INVALID'),
    endTime: z.string().min(1, 'FIELD_DATE_INVALID'),
    // RG-07: empty = unlimited, otherwise a whole number of at least 1
    capacity: z
      .string()
      .trim()
      .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1), {
        message: 'FIELD_CAPACITY_TOO_LOW',
      }),
  })
  .refine((slot) => !slot.startTime || !slot.endTime || slot.endTime > slot.startTime, {
    // RG-07: the end comes after the start, on the same day
    message: 'FIELD_END_NOT_AFTER_START',
    path: ['endTime'],
  });

export type SlotFormValues = z.input<typeof slotFormSchema>;

export const emptySlotForm = (date = ''): SlotFormValues => ({
  date,
  startTime: '',
  endTime: '',
  capacity: '',
});
