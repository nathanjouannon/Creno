// Source of truth for API errors (docs/api/errors.md, sections 2 and 3). Zod schemas never carry a message:
// they return a field code, translated here (ADR-0009). The client relies on `code`, never on `message`.

export interface ErrorDefinition {
  status: number;
  /** French message; `{name}` placeholders are filled from `details`. */
  message: string;
  /** Rule or cause (RG-xx, security.md section). */
  cause: string;
  /** Content of `details` for this code, as documented in errors.md (empty when none). */
  details: string;
  /** What the client does when it receives this code. */
  clientAction: string;
}

export const errorCatalog = {
  VALIDATION_ERROR: {
    status: 400,
    message: 'Certains champs sont invalides.',
    cause: 'Corps ou paramètre non conforme',
    details: '`fields`: liste de `{ field, code }` (section 3)',
    clientAction: 'Afficher le message de chaque champ sous celui-ci, garder les valeurs saisies',
  },
  AUTH_REQUIRED: {
    status: 401,
    message: 'Connecte-toi pour continuer.',
    cause: 'Pas de session, jeton expiré, utilisateur supprimé ou `tokenVersion` périmé',
    details: '',
    clientAction: 'Rediriger vers la connexion en mémorisant la page demandée',
  },
  AUTH_INVALID_CREDENTIALS: {
    status: 401,
    message: 'E-mail ou mot de passe incorrect.',
    cause:
      "Échec de connexion (F-02) ; identique pour une adresse sans compte, ou d'un compte supprimé",
    details: '',
    clientAction: 'Réafficher le formulaire, vider le mot de passe',
  },
  AUTH_ACCOUNT_LOCKED: {
    status: 423,
    message: 'Trop de tentatives. Réessaie dans 15 minutes.',
    cause:
      'RG-03 : 5 échecs consécutifs avec la même adresse ; identique pour une adresse sans compte',
    details: '`lockedUntil` (date-heure)',
    clientAction: 'Afficher le message et la fin du blocage',
  },
  AUTH_RESET_LINK_INVALID: {
    status: 410,
    message: "Ce lien n'est plus valide, demande un nouveau lien à un administrateur.",
    cause:
      'RG-12 : lien inconnu, expiré (plus de 3 jours), déjà utilisé ou remplacé par un plus récent',
    details: '',
    clientAction: 'Afficher le message à la place du formulaire',
  },
  INVITATION_INVALID: {
    status: 410,
    message: "Ce lien n'est plus valide, demande un nouveau lien à un administrateur.",
    cause: 'RG-02 : lien inconnu, événement commencé ou supprimé',
    details: '',
    clientAction: 'Afficher le message à la place du formulaire',
  },
  FORBIDDEN: {
    status: 403,
    message: "Tu n'as pas le droit d'accéder à cette page.",
    cause: 'RG-14 : action réservée aux administrateurs',
    details: '',
    clientAction: "Message générique, rien n'est modifié",
  },
  FORBIDDEN_ORIGIN: {
    status: 403,
    message: 'Requête refusée.',
    cause: "En-tête `Origin` différent de l'application (protection CSRF)",
    details: '',
    clientAction: "Message générique ; ne devrait pas arriver depuis l'interface",
  },
  NOT_FOUND: {
    status: 404,
    message: 'Page introuvable.',
    cause: "Route inconnue ; page d'installation après l'installation (RG-17)",
    details: '',
    clientAction: 'Afficher la page « introuvable »',
  },
  USER_NOT_FOUND: {
    status: 404,
    message: 'Membre introuvable.',
    cause: 'Identifiant inconnu',
    details: '',
    clientAction: 'Retour à la liste des membres',
  },
  EVENT_NOT_FOUND: {
    status: 404,
    message: 'Événement introuvable.',
    cause: 'Identifiant inconnu, ou événement passé vu par un utilisateur (RG-09)',
    details: '',
    clientAction: 'Retour à la liste des événements',
  },
  SLOT_NOT_FOUND: {
    status: 404,
    message: 'Créneau introuvable.',
    cause: "Identifiant inconnu, ou créneau d'un événement passé vu par un utilisateur (RG-09)",
    details: '',
    clientAction: "Recharger l'événement",
  },
  REGISTRATION_NOT_FOUND: {
    status: 404,
    message: 'Inscription introuvable.',
    cause: 'Identifiant inconnu, ou utilisateur non inscrit à ce créneau',
    details: '',
    clientAction: "Recharger l'événement",
  },
  FREE_SLOT_NOT_FOUND: {
    status: 404,
    message: 'Créneau libre introuvable.',
    cause:
      "RG-20 : identifiant inconnu, créneau libre d'un autre utilisateur, ou d'un événement passé vu par un utilisateur (RG-09)",
    details: '',
    clientAction: "Recharger l'événement",
  },
  USER_EMAIL_TAKEN: {
    status: 409,
    message: 'Un compte existe déjà avec cette adresse. Connecte-toi.',
    cause: 'RG-01 : e-mail déjà utilisé, sans tenir compte de la casse (création par invitation)',
    details: '',
    clientAction: 'Proposer le lien vers la connexion',
  },
  USER_EMAIL_IN_USE: {
    status: 409,
    message: 'Cette adresse est déjà utilisée par un autre compte.',
    cause:
      'RG-01, RG-18 : e-mail déjà pris, sans tenir compte de la casse (modification du profil)',
    details: '',
    clientAction: 'Afficher le message sous le champ e-mail, garder la saisie',
  },
  USER_LAST_ADMIN: {
    status: 409,
    message: "Nomme d'abord un autre administrateur.",
    cause:
      'RG-04 : le dernier administrateur ne peut ni se retirer le droit, ni supprimer son compte',
    details: '',
    clientAction: 'Afficher le message, rien ne change',
  },
  USER_ROLE_CHANGE_FORBIDDEN: {
    status: 403,
    message: "Seul l'intéressé peut retirer son droit administrateur.",
    cause: "RG-04 : tentative de retirer le droit d'un autre",
    details: '',
    clientAction: "Message générique ; l'interface ne propose pas cette action",
  },
  EVENT_PAST: {
    status: 409,
    message: "Cet événement est terminé, il n'est plus modifiable.",
    cause: 'RG-15 : événement passé en lecture seule (vu par un administrateur)',
    details: '',
    clientAction: 'Recharger la page en lecture seule',
  },
  EVENT_STARTED: {
    status: 409,
    message: "Cet événement a déjà commencé : plus d'invitation possible.",
    cause: "RG-02 : génération d'une invitation après le début",
    details: '',
    clientAction: 'Masquer « Inviter des bénévoles »',
  },
  SLOT_FULL: {
    status: 409,
    message: "Ce créneau vient d'être complété.",
    cause: 'RG-07 : limite atteinte',
    details: '`slotId`',
    clientAction: "Recharger l'événement, garder l'inscription précédente",
  },
  SLOT_STARTED: {
    status: 409,
    message: 'Ce créneau a commencé. Contacte un administrateur pour modifier ton inscription.',
    cause:
      'RG-08 : inscription ou désinscription après le début (heure courante supérieure ou égale au début)',
    details: '`slotId`',
    clientAction: "Recharger l'événement",
  },
  SLOT_CAPACITY_BELOW_REGISTRATIONS: {
    status: 409,
    message:
      '{registeredCount} personnes sont déjà inscrites : retire des inscrits avant de baisser la limite.',
    cause: "RG-07 : limite abaissée sous le nombre d'inscrits",
    details: '`registeredCount`',
    clientAction: 'Afficher le message, la limite reste inchangée',
  },
  REGISTRATION_ALREADY_EXISTS: {
    status: 409,
    message: 'Tu es déjà inscrit à ce créneau.',
    cause: 'RG-08 : une seule inscription par utilisateur et créneau',
    details: '`slotId`',
    clientAction: "Recharger l'événement",
  },
  EVENT_FREE_SLOTS_NOT_ALLOWED: {
    status: 409,
    message: 'Cet événement ne propose pas de créneaux libres.',
    cause: "RG-19 : créneau libre demandé sur un événement en mode `FIXED`",
    details: '',
    clientAction: "Recharger l'événement ; l'interface ne propose plus « Choisir mes horaires »",
  },
  EVENT_FIXED_SLOTS_NOT_ALLOWED: {
    status: 409,
    message: 'Cet événement ne propose que des créneaux libres.',
    cause: "RG-19 : créneau fixe demandé sur un événement en mode `FREE`",
    details: '',
    clientAction: "Recharger l'événement ; l'interface ne propose plus « Ajouter un créneau »",
  },
  EVENT_MODE_HAS_SLOTS: {
    status: 409,
    message: "Pour passer en créneaux libres, supprime d'abord les créneaux fixes ({slotCount}).",
    cause: "RG-19 : passage en mode `FREE` d'un événement qui a des créneaux fixes",
    details: '`slotCount`',
    clientAction: 'Afficher le message en tête du formulaire, le mode reste inchangé',
  },
  EVENT_MODE_HAS_FREE_SLOTS: {
    status: 409,
    message:
      "Pour passer en créneaux fixes, supprime d'abord les créneaux libres ({freeSlotCount}).",
    cause: "RG-19 : passage en mode `FIXED` d'un événement qui a des créneaux libres",
    details: '`freeSlotCount`',
    clientAction: 'Afficher le message en tête du formulaire, le mode reste inchangé',
  },
  FREE_SLOT_OVERLAP: {
    status: 409,
    message: 'Tu as déjà des horaires qui recouvrent ceux-ci.',
    cause:
      "RG-20 : recouvrement avec un autre créneau libre du même utilisateur dans l'événement (se toucher n'est pas se recouvrir)",
    details: '`freeSlotId` (le créneau libre qui recouvre)',
    clientAction: 'Afficher le message en tête de la fenêtre, garder la saisie',
  },
  FREE_SLOT_STARTED: {
    status: 409,
    message:
      'Ce créneau libre a commencé. Contacte un administrateur pour modifier ton inscription.',
    cause: 'RG-08, RG-20 : désinscription après le début (heure courante supérieure ou égale au début)',
    details: '`freeSlotId`',
    clientAction: "Recharger l'événement",
  },
  RATE_LIMITED: {
    status: 429,
    message: 'Trop de requêtes, réessaie plus tard.',
    cause: 'Limites de débit (`architecture/security.md`, section 4)',
    details: '',
    clientAction: 'Attendre `Retry-After`',
  },
  INTERNAL_ERROR: {
    status: 500,
    message: 'Une erreur est survenue.',
    cause: 'Bug serveur',
    details: '',
    clientAction: 'Afficher le `requestId`',
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: 'Le service est momentanément indisponible.',
    cause: '`/health` : base de données injoignable',
    details: '',
    clientAction: 'Réessayer plus tard',
  },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof errorCatalog;

export interface FieldErrorDefinition {
  message: string;
  cause: string;
}

export const fieldErrorCatalog = {
  FIELD_REQUIRED: {
    message: 'Ce champ est obligatoire.',
    cause:
      "Champ vide ou absent. Pour `title` : « Le titre est obligatoire » ; pour `firstName`, `lastName`, `email`, le formulaire d'invitation affiche le toast « Renseigne ton nom, ton prénom et une adresse e-mail valide »",
  },
  FIELD_EMAIL_INVALID: {
    message: 'Renseigne une adresse e-mail valide.',
    cause: "Format d'e-mail incorrect (RG-01)",
  },
  FIELD_PASSWORD_TOO_SHORT: {
    message: 'Le mot de passe doit contenir au moins 10 caractères.',
    cause: 'RG-01',
  },
  FIELD_PASSWORD_INCORRECT: {
    message: 'Le mot de passe actuel est incorrect.',
    cause: 'RG-18 : mot de passe actuel faux, porté par le champ `currentPassword`',
  },
  FIELD_DATE_INVALID: { message: 'Renseigne une date valide.', cause: 'Date-heure mal formée' },
  FIELD_END_NOT_AFTER_START: {
    message: 'La fin doit être après le début.',
    cause: 'RG-06 (événement), RG-07 (créneau) ; porté par le champ `endsAt`',
  },
  FIELD_CAPACITY_TOO_LOW: {
    message: "La limite doit être d'au moins 1 place (ou vide pour illimité).",
    cause: 'RG-07',
  },
  FIELD_DESCRIPTION_TOO_LONG: {
    message: 'La description ne peut pas dépasser 500 caractères.',
    cause:
      "RG-07 (F-21) : description d'un créneau de plus de 500 caractères ; portée par le champ `description`",
  },
  FIELD_TOO_MANY_SLOTS: {
    message: 'Un événement se crée avec 100 créneaux au plus ; ajoute les autres ensuite.',
    cause: 'RG-06 : plus de 100 créneaux envoyés avec un nouvel événement ; porté par le champ `slots`',
  },
  FIELD_FREE_SLOT_OUT_OF_EVENT: {
    message: "Les horaires doivent rester dans les dates de l'événement.",
    cause:
      "RG-20 : début avant celui de l'événement (champ `startsAt`) ou fin après la sienne (champ `endsAt`) ; vérifié par le service",
  },
  FIELD_FREE_SLOT_TOO_SHORT: {
    message: 'Un créneau libre dure au moins 30 minutes.',
    cause: 'RG-20 : moins de 30 minutes entre le début et la fin ; porté par le champ `endsAt`',
  },
  FIELD_START_NOT_IN_FUTURE: {
    message: 'Choisis une heure de début à venir.',
    cause:
      "RG-08, RG-20 : début d'un créneau libre égal ou antérieur à l'heure courante ; porté par le champ `startsAt`, vérifié par le service",
  },
  FIELD_REGISTRATION_MODE_INVALID: {
    message: "Choisis un mode d'inscription de la liste.",
    cause: 'RG-19 : valeur autre que `FIXED`, `FREE` ou `BOTH`',
  },
  FIELD_TIMEZONE_INVALID: {
    message: 'Choisis un fuseau horaire de la liste.',
    cause: 'RG-16 : valeur absente de la base IANA',
  },
  FIELD_ROLE_INVALID: { message: 'Rôle inconnu.', cause: 'Valeur autre que `USER` ou `ADMIN`' },
  FIELD_UNKNOWN: {
    message: 'Champ non reconnu.',
    cause: "Champ inattendu dans le corps ; filet de sécurité, pas affiché à l'utilisateur",
  },
} as const satisfies Record<string, FieldErrorDefinition>;

export type FieldErrorCode = keyof typeof fieldErrorCatalog;
