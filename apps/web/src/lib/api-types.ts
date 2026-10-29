import type {
  clubSchema,
  eventDetailSchema,
  eventSummarySchema,
  freeSlotSchema,
  registrationModeSchema,
  slotSchema,
  userSchema,
} from '@creno/validation';
import type { z } from 'zod';

// Types of the API answers, deduced from the schemas of the contract, never written twice.
export type Club = z.output<typeof clubSchema>;
export type EventSummary = z.output<typeof eventSummarySchema>;
export type EventDetail = z.output<typeof eventDetailSchema>;
export type Slot = z.output<typeof slotSchema>;
export type FreeSlot = z.output<typeof freeSlotSchema>;
export type RegistrationMode = z.output<typeof registrationModeSchema>;
export type User = z.output<typeof userSchema>;
