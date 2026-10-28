import { z } from 'zod';
import './openapi';
import {
  dateTime,
  endsAfterStarts,
  endsAfterStartsIssue,
  entityId,
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
    .max(500, 'FIELD_DESCRIPTION_TOO_LONG')
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

const text = () => z.string().nullable();

export const eventSummarySchema = z
  .object({
    id: entityId(),
    title: z.string(),
    location: text(),
    startsAt: outDateTime(),
    endsAt: outDateTime(),
    status: eventStatusSchema,
    slotCount: z.number().int().min(0),
  })
  .openapi('EventSummary');

export const eventDetailSchema = eventSummarySchema
  .extend({
    description: text(),
    slots: z.array(slotSchema).describe('Triés par date de début croissante'),
  })
  .openapi('EventDetail');

// RG-06: the end comes after the start; slots are optional.
export const eventInputSchema = z
  .object({
    title: z
      .string({ required_error: 'FIELD_REQUIRED', invalid_type_error: 'FIELD_REQUIRED' })
      .trim()
      .min(1, 'FIELD_REQUIRED'),
    description: text().optional(),
    location: text().optional(),
    startsAt: dateTime(),
    endsAt: dateTime().describe('Après `startsAt` (RG-06)'),
    slots: z.array(slotInputSchema).default([]),
  })
  .strict()
  .refine(endsAfterStarts, endsAfterStartsIssue)
  .openapi('EventInput');

export const eventUpdateSchema = z
  .object({
    title: z.string({ invalid_type_error: 'FIELD_REQUIRED' }).trim().min(1, 'FIELD_REQUIRED'),
    description: text(),
    location: text(),
    startsAt: dateTime(),
    endsAt: dateTime(),
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
