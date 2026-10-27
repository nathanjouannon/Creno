import { z } from 'zod';
import {
  emailSchema,
  entityId,
  idParam,
  outDateTime,
  passwordSchema,
  requiredString,
  roleSchema,
  timezoneSchema,
} from './common';

export const userSchema = z
  .object({
    id: entityId(),
    firstName: z.string(),
    lastName: z.string(),
    email: emailSchema,
    role: roleSchema,
    createdAt: outDateTime(),
  })
  .openapi('User');

export const clubSchema = z
  .object({
    name: z.string().min(1),
    timezone: z.string().describe('Fuseau horaire IANA'),
  })
  .openapi('Club');

export const setupInputSchema = z
  .object({
    club: z.object({ name: requiredString(), timezone: timezoneSchema }).strict(),
    admin: z
      .object({
        firstName: requiredString(),
        lastName: requiredString(),
        email: emailSchema,
        password: passwordSchema,
      })
      .strict(),
  })
  .strict()
  .openapi('SetupInput');

export type SetupInput = z.infer<typeof setupInputSchema>;

export const loginInputSchema = z
  .object({
    email: requiredString(),
    password: z
      .string({ required_error: 'FIELD_REQUIRED', invalid_type_error: 'FIELD_REQUIRED' })
      .min(1, 'FIELD_REQUIRED'),
  })
  .strict()
  .openapi('LoginInput');

export const acceptInvitationInputSchema = z
  .object({
    firstName: requiredString(),
    lastName: requiredString(),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict()
  .openapi('AcceptInvitationInput');

export const resetPasswordInputSchema = z.object({ password: passwordSchema }).strict();

export const setUserRoleInputSchema = z.object({ role: roleSchema }).strict();

export const shareableLinkSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe('Construite avec `APP_URL` ; contient le jeton, renvoyée une seule fois'),
    expiresAt: outDateTime().describe(
      "Fin de validité (3 jours pour une réinitialisation, début de l'événement pour une invitation)",
    ),
  })
  .openapi('ShareableLink');

export const passwordResetStatusSchema = z.object({ expiresAt: outDateTime() });

export const invitationStatusSchema = z.object({
  eventId: entityId(),
  eventTitle: z.string(),
  clubName: z.string(),
});

export const acceptedInvitationSchema = z.object({ user: userSchema, eventId: entityId() });

export const healthSchema = z.object({ status: z.enum(['ok']) });

export const tokenParamsSchema = z
  .object({
    token: z
      .string()
      .min(1, 'FIELD_REQUIRED')
      .describe("Jeton du lien, tel que contenu dans l'URL transmise"),
  })
  .strict();

export const userIdParamsSchema = z.object({ userId: idParam() }).strict();
