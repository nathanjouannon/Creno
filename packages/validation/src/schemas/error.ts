import { z } from 'zod';
import './openapi';

export const fieldErrorSchema = z
  .object({
    field: z.string(),
    code: z.string().describe('Code de champ du catalogue `errors.md`'),
  })
  .openapi('FieldError');

export const errorSchema = z
  .object({
    code: z.string().describe('Code stable du catalogue `errors.md`'),
    message: z.string().describe("Message affichable en français ; peut changer, ne pas s'y fier"),
    details: z
      .object({
        fields: z.array(fieldErrorSchema).optional().describe('Pour `VALIDATION_ERROR` seulement'),
      })
      .catchall(z.unknown())
      .optional()
      .describe('Informations propres au code (`lockedUntil`, `registeredCount`, `slotId`…)'),
    requestId: z.string().describe("Pour retrouver l'erreur dans les journaux"),
  })
  .openapi('Error');
