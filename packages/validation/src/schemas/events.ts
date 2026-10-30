import { z } from 'zod';
import './openapi';
import {
  dateTime,
  endsAfterStarts,
  endsAfterStartsIssue,
  entityId,
  FIELD_MAX_LENGTH,
  idParam,
  outDateTime,
} from './common';

export const eventStatusSchema = z
  .enum(['upcoming', 'ongoing', 'past'])
  .describe(
    'Calculé. `upcoming` avant le début, `ongoing` entre début et fin, `past` après la fin.',
  )
  .openapi('EventStatus');

export const attendeeSchema = z
  .object({
    registrationId: entityId().describe("Sert à l'administrateur pour retirer l'inscription"),
    displayName: z
      .string()
      .nullable()
      .describe(
        "« Prénom N. » (RG-09) ; `null` pour une inscription anonymisée (RG-11), que l'interface affiche « ancien membre »",
      ),
    isMe: z.boolean().describe("Vrai pour l'inscription de l'utilisateur connecté"),
  })
  .openapi('Attendee');

export const slotSchema = z
  .object({
    id: entityId(),
    eventId: entityId(),
    startsAt: outDateTime(),
    endsAt: outDateTime(),
    capacity: z.number().int().nullable().describe('`null` = places illimitées'),
    description: z
      .string()
      .nullable()
      .describe('Texte brut (jamais interprété), `null` = sans description (RG-07, F-21)'),
    registeredCount: z.number().int().min(0),
    remainingPlaces: z
      .number()
      .int()
      .nullable()
      .describe('`capacity` moins `registeredCount` ; `null` pour un créneau illimité'),
    full: z
      .boolean()
      .describe('Vrai seulement pour un créneau limité dont la capacité est atteinte'),
    started: z
      .boolean()
      .describe("Vrai si l'heure courante est supérieure ou égale au début du créneau (RG-08)"),
    attendees: z.array(attendeeSchema),
  })
  .openapi('Slot');

const capacity = () =>
  z
    .number({ invalid_type_error: 'FIELD_CAPACITY_TOO_LOW' })
    .int('FIELD_CAPACITY_TOO_LOW')
    .min(1, 'FIELD_CAPACITY_TOO_LOW')
    .nullable();

// RG-07, F-21: optional plain text of 500 characters at most; blank or `null` means none (the service stores `null`).
const slotDescription = () =>
  z
    .string()
    .trim()
    .max(FIELD_MAX_LENGTH.slotDescription, 'FIELD_DESCRIPTION_TOO_LONG')
    .nullable()
    .describe('Texte brut de 500 caractères au plus ; vide ou `null` = sans description (RG-07)');

// RG-07: `null` or absent = unlimited places, otherwise at least 1; a slot may exceed the event dates.
export const slotInputSchema = z
  .object({
    startsAt: dateTime(),
    endsAt: dateTime().describe('Après `startsAt` (RG-07)'),
    capacity: capacity()
      .default(null)
      .describe('Nombre de places ; `null` ou absent = illimité (RG-07)'),
    description: slotDescription().optional(),
  })
  .strict()
  .refine(endsAfterStarts, endsAfterStartsIssue)
  .openapi('SlotInput');

export const slotUpdateSchema = z
  .object({
    startsAt: dateTime(),
    endsAt: dateTime(),
    capacity: capacity(),
    description: slotDescription(),
  })
  .partial()
  .strict()
  .refine((slot) => Object.keys(slot).length > 0, { message: 'FIELD_REQUIRED' })
  .refine(endsAfterStarts, endsAfterStartsIssue)
  .openapi('SlotUpdate', { minProperties: 1 });

// RG-19, F-22: FIXED (fixed slots only, the default), FREE (free slots only) or BOTH.
export const registrationModeSchema = z
  .enum(['FIXED', 'FREE', 'BOTH'], {
    errorMap: () => ({ message: 'FIELD_REGISTRATION_MODE_INVALID' }),
  })
  .describe(
    "Mode d'inscription (RG-19) : `FIXED` créneaux fixes seulement (défaut), `FREE` créneaux libres seulement, `BOTH` les deux (les créneaux fixes sont alors indicatifs)",
  )
  .openapi('RegistrationMode');

/** RG-20: the minimum length of a free slot. */
export const FREE_SLOT_MIN_MINUTES = 30;

/** RG-20: at least 30 minutes between the start and the end (instants). */
export function lastsMinimum(value: { startsAt?: string; endsAt?: string }): boolean {
  if (value.startsAt === undefined || value.endsAt === undefined) return true;
  const minutes = (new Date(value.endsAt).getTime() - new Date(value.startsAt).getTime()) / 60_000;
  return minutes <= 0 || minutes >= FREE_SLOT_MIN_MINUTES; // a reversed range is reported by endsAfterStarts
}

export const freeSlotSchema = z
  .object({
    id: entityId().describe(
      "Identifiant de l'inscription ; sert aussi à `DELETE /registrations/{registrationId}` (retrait par un administrateur)",
    ),
    eventId: entityId(),
    startsAt: outDateTime(),
    endsAt: outDateTime(),
    started: z
      .boolean()
      .describe("Vrai si l'heure courante est supérieure ou égale au début (RG-08, RG-20)"),
    displayName: z
      .string()
      .nullable()
      .describe(
        "« Prénom N. » (RG-09) ; `null` pour une inscription anonymisée (RG-11), que l'interface affiche « ancien membre »",
      ),
    isMe: z.boolean().describe("Vrai pour un créneau libre de l'utilisateur connecté"),
  })
  .describe(
    "Créneau libre (F-22, RG-20) : inscription sans créneau fixe, avec les horaires choisis par l'utilisateur. Ni limite de places, ni état « complet ».",
  )
  .openapi('FreeSlot');

// RG-20: the end comes after the start, 30 minutes at least. The bounds of the event and the current time are
// checked by the service, which knows them (FIELD_FREE_SLOT_OUT_OF_EVENT, FIELD_START_NOT_IN_FUTURE).
export const freeSlotInputSchema = z
  .object({
    startsAt: dateTime().describe("Strictement après l'heure courante, dans les dates de l'événement"),
    endsAt: dateTime().describe(
      "Au moins 30 minutes après `startsAt`, au plus tard à la fin de l'événement (RG-20)",
    ),
  })
  .strict()
  .refine(endsAfterStarts, endsAfterStartsIssue)
  .refine(lastsMinimum, { message: 'FIELD_FREE_SLOT_TOO_SHORT', path: ['endsAt'] })
  .openapi('FreeSlotInput');

const text = () => z.string().nullable();

// RG-06 (#79): the title is trimmed, the description and the location are stored as typed
const eventTitle = () =>
  z
    .string({ required_error: 'FIELD_REQUIRED', invalid_type_error: 'FIELD_REQUIRED' })
    .trim()
    .min(1, 'FIELD_REQUIRED')
    .max(FIELD_MAX_LENGTH.eventTitle, 'FIELD_TOO_LONG')
    .describe('100 caractères au plus (RG-06)');
const eventDescription = () =>
  z
    .string()
    .max(FIELD_MAX_LENGTH.eventDescription, 'FIELD_TOO_LONG')
    .nullable()
    .describe('Texte brut de 2 000 caractères au plus (RG-06)');
const eventLocation = () =>
  z
    .string()
    .max(FIELD_MAX_LENGTH.eventLocation, 'FIELD_TOO_LONG')
    .nullable()
    .describe('200 caractères au plus (RG-06)');

export const eventSummarySchema = z
  .object({
    id: entityId(),
    title: z.string(),
    location: text(),
    startsAt: outDateTime(),
    endsAt: outDateTime(),
    status: eventStatusSchema,
    registrationMode: registrationModeSchema,
    slotCount: z.number().int().min(0).describe('Nombre de créneaux fixes'),
  })
  .openapi('EventSummary');

export const eventDetailSchema = eventSummarySchema
  .extend({
    description: text(),
    slots: z.array(slotSchema).describe('Créneaux fixes, triés par date de début croissante'),
    freeSlots: z
      .array(freeSlotSchema)
      .describe(
        'Créneaux libres (F-22), triés par début, fin puis `id` croissants ; vide en mode `FIXED`',
      ),
  })
  .openapi('EventDetail');

// RG-06: the end comes after the start; slots are optional.
export const eventInputSchema = z
  .object({
    title: eventTitle(),
    description: eventDescription().optional(),
    location: eventLocation().optional(),
    startsAt: dateTime(),
    endsAt: dateTime().describe('Après `startsAt` (RG-06)'),
    registrationMode: registrationModeSchema
      .default('FIXED')
      .describe("Mode d'inscription (RG-19) ; `FIXED` s'il est absent"),
    slots: z
      .array(slotInputSchema)
      .default([])
      .describe('Créneaux fixes ; refusés en mode `FREE` (RG-19)'),
  })
  .strict()
  .refine(endsAfterStarts, endsAfterStartsIssue)
  .openapi('EventInput');

export const eventUpdateSchema = z
  .object({
    title: eventTitle(),
    description: eventDescription(),
    location: eventLocation(),
    startsAt: dateTime(),
    endsAt: dateTime(),
    registrationMode: registrationModeSchema,
  })
  .partial()
  .strict()
  .refine((event) => Object.keys(event).length > 0, { message: 'FIELD_REQUIRED' })
  .refine(endsAfterStarts, endsAfterStartsIssue)
  .openapi('EventUpdate', { minProperties: 1 });

export const listEventsQuerySchema = z
  .object({ scope: z.enum(['upcoming', 'past']).default('upcoming') })
  .describe('`upcoming` : à venir et en cours ; `past` : terminés, réservé aux administrateurs');

export const eventIdParamsSchema = z.object({ eventId: idParam() }).strict();
export const slotIdParamsSchema = z.object({ slotId: idParam() }).strict();
export const registrationIdParamsSchema = z.object({ registrationId: idParam() }).strict();
export const freeSlotIdParamsSchema = z.object({ freeSlotId: idParam() }).strict();
