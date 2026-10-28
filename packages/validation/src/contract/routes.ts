import type { ZodTypeAny } from 'zod';
import type { ErrorCode } from '../errors';
import {
  acceptInvitationInputSchema,
  acceptedInvitationSchema,
  clubSchema,
  eventDetailSchema,
  eventIdParamsSchema,
  eventInputSchema,
  eventSummarySchema,
  eventUpdateSchema,
  healthSchema,
  invitationStatusSchema,
  listEventsQuerySchema,
  loginInputSchema,
  passwordResetStatusSchema,
  registrationIdParamsSchema,
  resetPasswordInputSchema,
  setUserRoleInputSchema,
  setupInputSchema,
  shareableLinkSchema,
  slotIdParamsSchema,
  slotInputSchema,
  slotSchema,
  slotUpdateSchema,
  tokenParamsSchema,
  updateProfileInputSchema,
  userIdParamsSchema,
  userSchema,
} from '../schemas';
import { z } from 'zod';

export type RouteAuth = 'public' | 'user' | 'admin';
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ErrorResponse {
  status: number;
  /** Codes of `errors.md` this response can carry; each one must have this status in the catalog. */
  codes: ErrorCode[];
  description: string;
}

/** Responses repeated on many routes; they become `components.responses` in the contract. */
export const sharedResponses = {
  ValidationError: {
    status: 400,
    codes: ['VALIDATION_ERROR'],
    description:
      'Données invalides (`VALIDATION_ERROR`) ; `details.fields` liste les champs en cause',
  },
  Unauthenticated: {
    status: 401,
    codes: ['AUTH_REQUIRED'],
    description: 'Non connecté ou session refusée (`AUTH_REQUIRED`)',
  },
  Forbidden: {
    status: 403,
    codes: ['FORBIDDEN'],
    description: 'Action réservée aux administrateurs (`FORBIDDEN`, RG-14)',
  },
  NotFound: {
    status: 404,
    codes: ['NOT_FOUND'],
    description: 'Ressource introuvable (`NOT_FOUND`)',
  },
  EventNotFound: {
    status: 404,
    codes: ['EVENT_NOT_FOUND'],
    description: 'Événement inconnu, ou passé pour un utilisateur (`EVENT_NOT_FOUND`, RG-09)',
  },
  SlotNotFound: {
    status: 404,
    codes: ['SLOT_NOT_FOUND'],
    description:
      "Créneau inconnu, ou d'un événement passé pour un utilisateur (`SLOT_NOT_FOUND`, RG-09)",
  },
  UserNotFound: {
    status: 404,
    codes: ['USER_NOT_FOUND'],
    description: 'Utilisateur inconnu (`USER_NOT_FOUND`)',
  },
  EventPast: {
    status: 409,
    codes: ['EVENT_PAST'],
    description: 'Événement passé, donc en lecture seule (`EVENT_PAST`, RG-15)',
  },
  RateLimited: {
    status: 429,
    codes: ['RATE_LIMITED'],
    description: 'Trop de requêtes (`RATE_LIMITED`)',
  },
} as const satisfies Record<string, ErrorResponse>;

export type SharedResponseName = keyof typeof sharedResponses;

export interface RouteDefinition {
  operationId: string;
  method: HttpMethod;
  /** OpenAPI path, relative to `/api` (or to the root when `atRoot`). */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /** Who may call: nobody in particular, any signed-in user, or an administrator (RG-14). */
  auth: RouteAuth;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
  success: {
    status: number;
    description: string;
    schema?: ZodTypeAny;
    /** The response sets or clears the session cookie. */
    setsCookie?: boolean;
  };
  errors: (SharedResponseName | ErrorResponse)[];
  /** Served at the root, outside `/api` (`/health`). */
  atRoot?: boolean;
}

const error = (status: number, codes: ErrorCode[], description: string): ErrorResponse => ({
  status,
  codes,
  description,
});

const resetLinkInvalid = error(
  410,
  ['AUTH_RESET_LINK_INVALID'],
  'Lien inconnu, expiré, déjà utilisé ou remplacé (`AUTH_RESET_LINK_INVALID`)',
);
const invitationInvalid = error(
  410,
  ['INVITATION_INVALID'],
  'Lien inconnu, événement commencé ou supprimé (`INVITATION_INVALID`)',
);

export const routes: RouteDefinition[] = [
  {
    operationId: 'setup',
    method: 'post',
    path: '/setup',
    tag: 'Installation',
    summary: "Installer l'instance (F-19, RG-17)",
    description: [
      'Crée le club et le premier administrateur, atomiquement, puis ouvre sa session.',
      "Disponible seulement tant qu'aucun utilisateur n'existe ; ensuite répond `404 NOT_FOUND`.",
      "Si deux installations arrivent en même temps, une seule aboutit, l'autre reçoit `404 NOT_FOUND`.",
      "Avant l'installation, l'interface redirige toutes ses pages vers la page d'installation (contrôle côté serveur Next.js, pas d'endpoint dédié).",
    ].join('\n'),
    auth: 'public',
    body: setupInputSchema,
    success: {
      status: 201,
      description: 'Club et administrateur créés, session ouverte',
      schema: userSchema,
      setsCookie: true,
    },
    errors: ['ValidationError', 'NotFound', 'RateLimited'],
  },
  {
    operationId: 'getClub',
    method: 'get',
    path: '/club',
    tag: 'Installation',
    summary: 'Nom et fuseau horaire du club (RG-16)',
    auth: 'user',
    success: { status: 200, description: 'Le club', schema: clubSchema },
    errors: ['Unauthenticated'],
  },
  {
    operationId: 'login',
    method: 'post',
    path: '/auth/login',
    tag: 'Authentification',
    summary: 'Se connecter (F-02, RG-03)',
    description: [
      'Après 5 échecs consécutifs avec la même adresse saisie, la connexion avec cette adresse est bloquée 15 minutes, même avec le bon mot de passe.',
      "La réponse est identique que l'adresse ait un compte ou non, et le temps de réponse ne doit pas le trahir (`security.md`).",
      "Une connexion réussie remet le compteur à zéro. Le retour à la page demandée est géré par l'interface.",
    ].join('\n'),
    auth: 'public',
    body: loginInputSchema,
    success: { status: 200, description: 'Connecté', schema: userSchema, setsCookie: true },
    errors: [
      'ValidationError',
      error(
        401,
        ['AUTH_INVALID_CREDENTIALS'],
        'E-mail ou mot de passe incorrect (`AUTH_INVALID_CREDENTIALS`)',
      ),
      error(
        423,
        ['AUTH_ACCOUNT_LOCKED'],
        'Adresse bloquée (`AUTH_ACCOUNT_LOCKED`, RG-03). `details.lockedUntil` donne la fin du blocage.',
      ),
      'RateLimited',
    ],
  },
  {
    operationId: 'logout',
    method: 'post',
    path: '/auth/logout',
    tag: 'Authentification',
    summary: 'Se déconnecter (F-02)',
    description: 'Efface le cookie de session. Répond `204` même si la session était déjà expirée.',
    auth: 'public',
    success: { status: 204, description: 'Déconnecté', setsCookie: true },
    errors: [],
  },
  {
    operationId: 'getMe',
    method: 'get',
    path: '/me',
    tag: 'Authentification',
    summary: 'Utilisateur connecté',
    description: 'Le rôle renvoyé est lu en base à chaque requête, pas dans le jeton (ADR-0006).',
    auth: 'user',
    success: { status: 200, description: "L'utilisateur connecté", schema: userSchema },
    errors: ['Unauthenticated'],
  },
  {
    operationId: 'updateMe',
    method: 'patch',
    path: '/me',
    tag: 'Authentification',
    summary: 'Modifier son nom, son prénom ou son e-mail (F-20, RG-18)',
    description: [
      "Les trois champs sont renvoyés à chaque appel. `currentPassword` n'est exigé que si l'e-mail change : absent, `VALIDATION_ERROR` sur `currentPassword` (`FIELD_REQUIRED`) ; faux, `VALIDATION_ERROR` (`FIELD_PASSWORD_INCORRECT`).",
      "La session ouverte reste valable. Aucun e-mail n'est envoyé (RG-13).",
    ].join('\n'),
    auth: 'user',
    body: updateProfileInputSchema,
    success: { status: 200, description: "L'utilisateur mis à jour", schema: userSchema },
    errors: [
      'Unauthenticated',
      'ValidationError',
      error(409, ['USER_EMAIL_IN_USE'], 'Adresse déjà utilisée (`USER_EMAIL_IN_USE`, RG-01)'),
      'RateLimited',
    ],
  },
  {
    operationId: 'deleteMe',
    method: 'delete',
    path: '/me',
    tag: 'Authentification',
    summary: 'Supprimer son compte (F-11, RG-11)',
    description: [
      "Efface le nom, le prénom et l'e-mail ; libère les inscriptions des créneaux qui n'ont pas commencé ; anonymise celles des créneaux commencés (« ancien membre »).",
      "Efface le cookie de session. Refusé pour le dernier administrateur (RG-04). La confirmation est demandée par l'interface, pas par l'API.",
    ].join('\n'),
    auth: 'user',
    success: { status: 204, description: 'Compte supprimé', setsCookie: true },
    errors: [
      'Unauthenticated',
      error(409, ['USER_LAST_ADMIN'], 'Dernier administrateur (`USER_LAST_ADMIN`, RG-04)'),
    ],
  },
  {
    operationId: 'checkAccountDeletion',
    method: 'get',
    path: '/me/deletion-check',
    tag: 'Authentification',
    summary: 'Vérifier que son compte peut être supprimé (F-11, RG-04)',
    description:
      "Ne supprime rien. Permet à l'interface de refuser dès le clic, sans écran de confirmation, le dernier administrateur ; `DELETE /me` refait le contrôle dans sa transaction.",
    auth: 'user',
    success: { status: 204, description: 'Le compte peut être supprimé' },
    errors: [
      'Unauthenticated',
      error(409, ['USER_LAST_ADMIN'], 'Dernier administrateur (`USER_LAST_ADMIN`, RG-04)'),
    ],
  },
  {
    operationId: 'checkPasswordReset',
    method: 'get',
    path: '/password-resets/{token}',
    tag: 'Authentification',
    summary: 'Vérifier un lien de réinitialisation (F-02, RG-12)',
    description:
      "Permet à l'interface d'afficher le formulaire ou le message « Ce lien n'est plus valide ».",
    auth: 'public',
    params: tokenParamsSchema,
    success: { status: 200, description: 'Lien valide', schema: passwordResetStatusSchema },
    errors: [resetLinkInvalid, 'RateLimited'],
  },
  {
    operationId: 'resetPassword',
    method: 'post',
    path: '/password-resets/{token}',
    tag: 'Authentification',
    summary: 'Choisir un nouveau mot de passe (F-02, RG-12)',
    description: [
      "Le lien devient inutilisable, `tokenVersion` augmente (toutes les sessions de l'utilisateur tombent), le blocage de RG-03 est levé.",
      "L'utilisateur n'est pas connecté par cet appel : il se connecte ensuite avec son nouveau mot de passe.",
    ].join('\n'),
    auth: 'public',
    params: tokenParamsSchema,
    body: resetPasswordInputSchema,
    success: { status: 204, description: 'Mot de passe changé' },
    errors: ['ValidationError', resetLinkInvalid, 'RateLimited'],
  },
  {
    operationId: 'createPasswordReset',
    method: 'post',
    path: '/users/{userId}/password-resets',
    tag: 'Membres',
    summary: 'Générer un lien de réinitialisation (F-10, RG-12)',
    description: [
      'Administrateur seulement. Valable 3 jours, à usage unique. Générer un nouveau lien invalide les précédents.',
      "Le jeton n'est stocké que haché : l'URL n'est renvoyée qu'ici, une seule fois.",
    ].join('\n'),
    auth: 'admin',
    params: userIdParamsSchema,
    success: { status: 201, description: 'Lien créé', schema: shareableLinkSchema },
    errors: ['Unauthenticated', 'Forbidden', 'UserNotFound'],
  },
  {
    operationId: 'createInvitation',
    method: 'post',
    path: '/events/{eventId}/invitations',
    tag: 'Invitations',
    summary: "Générer un lien d'invitation (F-01, RG-02)",
    description: [
      "Administrateur seulement. Réutilisable par plusieurs personnes, valable jusqu'à la date et l'heure de début actuelles de l'événement",
      "(reporter l'événement prolonge la validité). Chaque appel crée un nouveau lien ; les liens précédents restent valables.",
      "Le jeton n'est stocké que haché : l'URL n'est renvoyée qu'ici, une seule fois.",
    ].join('\n'),
    auth: 'admin',
    params: eventIdParamsSchema,
    success: {
      status: 201,
      description: "Lien créé ; `expiresAt` est le début de l'événement",
      schema: shareableLinkSchema,
    },
    errors: [
      'Unauthenticated',
      'Forbidden',
      'EventNotFound',
      error(409, ['EVENT_STARTED'], "L'événement a déjà commencé (`EVENT_STARTED`, RG-02)"),
    ],
  },
  {
    operationId: 'checkInvitation',
    method: 'get',
    path: '/invitations/{token}',
    tag: 'Invitations',
    summary: "Vérifier un lien d'invitation (F-01, RG-02)",
    auth: 'public',
    params: tokenParamsSchema,
    success: { status: 200, description: 'Invitation valide', schema: invitationStatusSchema },
    errors: [invitationInvalid, 'RateLimited'],
  },
  {
    operationId: 'acceptInvitation',
    method: 'post',
    path: '/invitations/{token}',
    tag: 'Invitations',
    summary: 'Créer son compte depuis une invitation (F-01, RG-01, RG-02)',
    description: [
      'Crée un utilisateur de rôle `USER`, actif immédiatement, et ouvre sa session. `eventId` indique la page où rediriger.',
      "L'e-mail est comparé sans tenir compte de la casse et les espaces autour sont retirés.",
    ].join('\n'),
    auth: 'public',
    params: tokenParamsSchema,
    body: acceptInvitationInputSchema,
    success: {
      status: 201,
      description: 'Compte créé, session ouverte',
      schema: acceptedInvitationSchema,
      setsCookie: true,
    },
    errors: [
      'ValidationError',
      error(
        409,
        ['USER_EMAIL_TAKEN'],
        "E-mail déjà utilisé (`USER_EMAIL_TAKEN`) ; l'interface propose de se connecter",
      ),
      invitationInvalid,
      'RateLimited',
    ],
  },
  {
    operationId: 'listEvents',
    method: 'get',
    path: '/events',
    tag: 'Événements',
    summary: 'Lister les événements (F-06, F-09, RG-09)',
    description: [
      '`upcoming` (défaut) : événements à venir et en cours, par date de début croissante.',
      '`past` : événements terminés, par date de fin décroissante ; réservé aux administrateurs (`403 FORBIDDEN` sinon).',
    ].join('\n'),
    auth: 'user',
    query: listEventsQuerySchema,
    success: { status: 200, description: 'Les événements', schema: z.array(eventSummarySchema) },
    errors: ['Unauthenticated', 'Forbidden'],
  },
  {
    operationId: 'createEvent',
    method: 'post',
    path: '/events',
    tag: 'Événements',
    summary: 'Créer un événement (F-04, F-05, RG-06, RG-07)',
    description:
      'Administrateur seulement. Les créneaux sont facultatifs ; un événement peut être créé sans créneau.',
    auth: 'admin',
    body: eventInputSchema,
    success: { status: 201, description: 'Événement créé', schema: eventDetailSchema },
    errors: ['ValidationError', 'Unauthenticated', 'Forbidden'],
  },
  {
    operationId: 'getEvent',
    method: 'get',
    path: '/events/{eventId}',
    tag: 'Événements',
    summary: "Détail d'un événement avec ses créneaux et inscrits (F-06, F-09, RG-09)",
    description:
      "Un événement passé répond `404 EVENT_NOT_FOUND` à un utilisateur, comme s'il n'existait pas ; un administrateur le voit en lecture seule.",
    auth: 'user',
    params: eventIdParamsSchema,
    success: { status: 200, description: "L'événement", schema: eventDetailSchema },
    errors: ['Unauthenticated', 'EventNotFound'],
  },
  {
    operationId: 'updateEvent',
    method: 'patch',
    path: '/events/{eventId}',
    tag: 'Événements',
    summary: 'Modifier un événement (F-04, RG-06, RG-15)',
    description:
      'Administrateur seulement. Champs facultatifs ; ceux envoyés remplacent les anciens. Les inscriptions sont conservées.',
    auth: 'admin',
    params: eventIdParamsSchema,
    body: eventUpdateSchema,
    success: { status: 200, description: 'Événement modifié', schema: eventDetailSchema },
    errors: ['ValidationError', 'Unauthenticated', 'Forbidden', 'EventNotFound', 'EventPast'],
  },
  {
    operationId: 'deleteEvent',
    method: 'delete',
    path: '/events/{eventId}',
    tag: 'Événements',
    summary: 'Supprimer un événement (F-04, RG-10, RG-15)',
    description:
      "Administrateur seulement. Supprime aussi ses créneaux, inscriptions et invitations. La confirmation qui indique le nombre d'inscrits est demandée par l'interface (RG-10), pas par l'API.",
    auth: 'admin',
    params: eventIdParamsSchema,
    success: { status: 204, description: 'Événement supprimé' },
    errors: ['Unauthenticated', 'Forbidden', 'EventNotFound', 'EventPast'],
  },
  {
    operationId: 'createSlot',
    method: 'post',
    path: '/events/{eventId}/slots',
    tag: 'Créneaux',
    summary: 'Ajouter un créneau (F-05, RG-07)',
    description:
      "Administrateur seulement. Un créneau peut sortir des dates de l'événement (RG-07).",
    auth: 'admin',
    params: eventIdParamsSchema,
    body: slotInputSchema,
    success: { status: 201, description: 'Créneau créé', schema: slotSchema },
    errors: ['ValidationError', 'Unauthenticated', 'Forbidden', 'EventNotFound', 'EventPast'],
  },
  {
    operationId: 'updateSlot',
    method: 'patch',
    path: '/slots/{slotId}',
    tag: 'Créneaux',
    summary: 'Modifier un créneau (F-05, RG-07, RG-15)',
    description: [
      'Administrateur seulement. Champs facultatifs. `capacity: null` rend le créneau illimité.',
      "La limite ne peut pas être abaissée sous le nombre d'inscrits (vérification atomique avec les inscriptions concurrentes).",
    ].join('\n'),
    auth: 'admin',
    params: slotIdParamsSchema,
    body: slotUpdateSchema,
    success: { status: 200, description: 'Créneau modifié', schema: slotSchema },
    errors: [
      'ValidationError',
      'Unauthenticated',
      'Forbidden',
      'SlotNotFound',
      error(
        409,
        ['EVENT_PAST', 'SLOT_CAPACITY_BELOW_REGISTRATIONS'],
        '`EVENT_PAST` (RG-15) ou `SLOT_CAPACITY_BELOW_REGISTRATIONS` (RG-07, `details.registeredCount`)',
      ),
    ],
  },
  {
    operationId: 'deleteSlot',
    method: 'delete',
    path: '/slots/{slotId}',
    tag: 'Créneaux',
    summary: 'Supprimer un créneau (F-05, RG-10, RG-15)',
    description:
      "Administrateur seulement. Supprime ses inscriptions. La confirmation est demandée par l'interface (RG-10). Supprimer le dernier créneau conserve l'événement (RG-06).",
    auth: 'admin',
    params: slotIdParamsSchema,
    success: { status: 204, description: 'Créneau supprimé' },
    errors: ['Unauthenticated', 'Forbidden', 'SlotNotFound', 'EventPast'],
  },
  {
    operationId: 'register',
    method: 'post',
    path: '/slots/{slotId}/registrations',
    tag: 'Inscriptions',
    summary: "S'inscrire à un créneau (F-07, RG-07, RG-08)",
    description: [
      "Inscrit l'utilisateur connecté, administrateur compris. Sans corps de requête.",
      "Refusée si le créneau a commencé (heure courante supérieure ou égale à son début) ou s'il est complet.",
      "Atomique : la dernière place n'est attribuée qu'à une personne. Le chevauchement de deux créneaux n'est pas contrôlé.",
      "Le changement de créneau (F-08) est une désinscription suivie d'une inscription : deux appels, l'inscription d'origine est conservée si la seconde échoue.",
    ].join('\n'),
    auth: 'user',
    params: slotIdParamsSchema,
    success: {
      status: 201,
      description: 'Inscrit ; renvoie le créneau à jour',
      schema: slotSchema,
    },
    errors: [
      'Unauthenticated',
      'SlotNotFound',
      error(
        409,
        ['SLOT_FULL', 'SLOT_STARTED', 'REGISTRATION_ALREADY_EXISTS', 'EVENT_PAST'],
        '`SLOT_FULL` (RG-07), `SLOT_STARTED` (RG-08), `REGISTRATION_ALREADY_EXISTS` (RG-08) ou `EVENT_PAST` (RG-15, administrateur seulement, un utilisateur reçoit `404`)',
      ),
    ],
  },
  {
    operationId: 'unregister',
    method: 'delete',
    path: '/slots/{slotId}/registrations/me',
    tag: 'Inscriptions',
    summary: "Se désinscrire d'un créneau (F-08, RG-08)",
    description:
      "Supprime l'inscription de l'utilisateur connecté, tant que le créneau n'a pas commencé. La confirmation est demandée par l'interface.",
    auth: 'user',
    params: slotIdParamsSchema,
    success: { status: 204, description: 'Désinscrit' },
    errors: [
      'Unauthenticated',
      error(
        404,
        ['SLOT_NOT_FOUND', 'REGISTRATION_NOT_FOUND'],
        'Créneau inconnu (`SLOT_NOT_FOUND`) ou utilisateur non inscrit (`REGISTRATION_NOT_FOUND`)',
      ),
      error(
        409,
        ['SLOT_STARTED', 'EVENT_PAST'],
        '`SLOT_STARTED` (RG-08) ou `EVENT_PAST` (RG-15, administrateur seulement)',
      ),
    ],
  },
  {
    operationId: 'removeRegistration',
    method: 'delete',
    path: '/registrations/{registrationId}',
    tag: 'Inscriptions',
    summary: "Retirer l'inscription d'un autre utilisateur (F-09, RG-08)",
    description: [
      "Administrateur seulement. Possible même sur un créneau commencé, tant que l'événement n'est pas passé (RG-15).",
      "La confirmation (« Marie D. ne sera plus inscrite à ce créneau ») est demandée par l'interface.",
    ].join('\n'),
    auth: 'admin',
    params: registrationIdParamsSchema,
    success: { status: 204, description: 'Inscription retirée' },
    errors: [
      'Unauthenticated',
      'Forbidden',
      error(404, ['REGISTRATION_NOT_FOUND'], 'Inscription inconnue (`REGISTRATION_NOT_FOUND`)'),
      'EventPast',
    ],
  },
  {
    operationId: 'listUsers',
    method: 'get',
    path: '/users',
    tag: 'Membres',
    summary: 'Lister les membres (F-10)',
    description: 'Administrateur seulement. Tri par nom puis prénom.',
    auth: 'admin',
    success: { status: 200, description: 'Les utilisateurs', schema: z.array(userSchema) },
    errors: ['Unauthenticated', 'Forbidden'],
  },
  {
    operationId: 'getUser',
    method: 'get',
    path: '/users/{userId}',
    tag: 'Membres',
    summary: "Fiche d'un membre (F-10)",
    description: 'Administrateur seulement.',
    auth: 'admin',
    params: userIdParamsSchema,
    success: { status: 200, description: "L'utilisateur", schema: userSchema },
    errors: ['Unauthenticated', 'Forbidden', 'UserNotFound'],
  },
  {
    operationId: 'setUserRole',
    method: 'put',
    path: '/users/{userId}/role',
    tag: 'Membres',
    summary: "Changer le rôle d'un membre (F-10, RG-04)",
    description: [
      "Administrateur seulement. Un administrateur peut donner `ADMIN` à un autre utilisateur ; seul l'intéressé peut retirer son propre droit (passer à `USER`).",
      'Le dernier administrateur ne peut pas se retirer le droit ; le contrôle est atomique (deux retraits simultanés ne peuvent pas laisser zéro administrateur).',
      'Mettre un rôle déjà porté est sans effet et répond `200`.',
    ].join('\n'),
    auth: 'admin',
    params: userIdParamsSchema,
    body: setUserRoleInputSchema,
    success: { status: 200, description: 'Rôle à jour', schema: userSchema },
    errors: [
      'ValidationError',
      'Unauthenticated',
      error(
        403,
        ['FORBIDDEN', 'USER_ROLE_CHANGE_FORBIDDEN'],
        "`FORBIDDEN` (pas administrateur) ou `USER_ROLE_CHANGE_FORBIDDEN` (retirer le droit d'un autre, RG-04)",
      ),
      'UserNotFound',
      error(409, ['USER_LAST_ADMIN'], 'Dernier administrateur (`USER_LAST_ADMIN`, RG-04)'),
    ],
  },
  {
    operationId: 'health',
    method: 'get',
    path: '/health',
    atRoot: true,
    tag: 'Supervision',
    summary: 'Vérification de santé',
    description:
      'Public, sans authentification ni limite de débit. Utilisé par Docker et par la mise en production (`environments.md`, section 4).',
    auth: 'public',
    success: {
      status: 200,
      description: "L'application répond et la base est joignable",
      schema: healthSchema,
    },
    errors: [error(503, ['SERVICE_UNAVAILABLE'], 'Base de données injoignable')],
  },
];
