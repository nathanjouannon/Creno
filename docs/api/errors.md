<!-- Fichier généré par `pnpm api:generate` depuis packages/validation (ADR-0014). Ne pas modifier à la main : changer le schéma Zod ou le registre des routes, puis régénérer. -->

# Catalogue des erreurs – Créno

Statut : version 0.1 (2026-10-26). Les messages reprennent ceux des scénarios de `user-stories.md`. Les schémas Zod n'écrivent jamais de message : ils renvoient un code de champ (section 3), traduit ici (ADR-0009).

Ce fichier et `errors.json` sont générés depuis le catalogue TypeScript de `packages/validation` (ADR-0014) ; `pnpm api:check` échoue s'ils diffèrent.

## 1. Format commun

Toute erreur de l'API renvoie ce JSON (schéma `Error` de `openapi.yaml`) :

```json
{
  "code": "SLOT_FULL",
  "message": "Ce créneau vient d'être complété.",
  "details": { "slotId": 12 },
  "requestId": "req_8f3a21c4"
}
```

- Le client se base sur `code` (stable), jamais sur `message` (peut changer).
- `details` est facultatif ; son contenu dépend du code (colonne « Détails »).
- `requestId` permet de retrouver l'erreur dans les journaux ; l'interface l'affiche pour `INTERNAL_ERROR`.
- Une réponse `429` ajoute l'en-tête `Retry-After` (secondes).

## 2. Codes

| Code | HTTP | Message affiché | Cause / règle | Détails | Action du client |
| --- | --- | --- | --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Certains champs sont invalides. | Corps ou paramètre non conforme | `fields`: liste de `{ field, code }` (section 3) | Afficher le message de chaque champ sous celui-ci, garder les valeurs saisies |
| `AUTH_REQUIRED` | 401 | Connecte-toi pour continuer. | Pas de session, jeton expiré, utilisateur supprimé ou `tokenVersion` périmé | | Rediriger vers la connexion en mémorisant la page demandée |
| `AUTH_INVALID_CREDENTIALS` | 401 | E-mail ou mot de passe incorrect. | Échec de connexion (F-02) ; identique pour une adresse sans compte, ou d'un compte supprimé | | Réafficher le formulaire, vider le mot de passe |
| `AUTH_ACCOUNT_LOCKED` | 423 | Trop de tentatives. Réessaie dans 15 minutes. | RG-03 : 5 échecs consécutifs avec la même adresse ; identique pour une adresse sans compte | `lockedUntil` (date-heure) | Afficher le message et la fin du blocage |
| `AUTH_RESET_LINK_INVALID` | 410 | Ce lien n'est plus valide, demande un nouveau lien à un administrateur. | RG-12 : lien inconnu, expiré (plus de 3 jours), déjà utilisé ou remplacé par un plus récent | | Afficher le message à la place du formulaire |
| `INVITATION_INVALID` | 410 | Ce lien n'est plus valide, demande un nouveau lien à un administrateur. | RG-02 : lien inconnu, événement commencé ou supprimé | | Afficher le message à la place du formulaire |
| `FORBIDDEN` | 403 | Tu n'as pas le droit d'accéder à cette page. | RG-14 : action réservée aux administrateurs | | Message générique, rien n'est modifié |
| `FORBIDDEN_ORIGIN` | 403 | Requête refusée. | En-tête `Origin` différent de l'application (protection CSRF) | | Message générique ; ne devrait pas arriver depuis l'interface |
| `NOT_FOUND` | 404 | Page introuvable. | Route inconnue ; page d'installation après l'installation (RG-17) | | Afficher la page « introuvable » |
| `USER_NOT_FOUND` | 404 | Membre introuvable. | Identifiant inconnu | | Retour à la liste des membres |
| `EVENT_NOT_FOUND` | 404 | Événement introuvable. | Identifiant inconnu, ou événement passé vu par un utilisateur (RG-09) | | Retour à la liste des événements |
| `SLOT_NOT_FOUND` | 404 | Créneau introuvable. | Identifiant inconnu, ou créneau d'un événement passé vu par un utilisateur (RG-09) | | Recharger l'événement |
| `REGISTRATION_NOT_FOUND` | 404 | Inscription introuvable. | Identifiant inconnu, ou utilisateur non inscrit à ce créneau | | Recharger l'événement |
| `USER_EMAIL_TAKEN` | 409 | Un compte existe déjà avec cette adresse. Connecte-toi. | RG-01 : e-mail déjà utilisé, sans tenir compte de la casse (création par invitation) | | Proposer le lien vers la connexion |
| `USER_EMAIL_IN_USE` | 409 | Cette adresse est déjà utilisée par un autre compte. | RG-01, RG-18 : e-mail déjà pris, sans tenir compte de la casse (modification du profil) | | Afficher le message sous le champ e-mail, garder la saisie |
| `USER_LAST_ADMIN` | 409 | Nomme d'abord un autre administrateur. | RG-04 : le dernier administrateur ne peut ni se retirer le droit, ni supprimer son compte | | Afficher le message, rien ne change |
| `USER_ROLE_CHANGE_FORBIDDEN` | 403 | Seul l'intéressé peut retirer son droit administrateur. | RG-04 : tentative de retirer le droit d'un autre | | Message générique ; l'interface ne propose pas cette action |
| `EVENT_PAST` | 409 | Cet événement est terminé, il n'est plus modifiable. | RG-15 : événement passé en lecture seule (vu par un administrateur) | | Recharger la page en lecture seule |
| `EVENT_STARTED` | 409 | Cet événement a déjà commencé : plus d'invitation possible. | RG-02 : génération d'une invitation après le début | | Masquer « Inviter des bénévoles » |
| `SLOT_FULL` | 409 | Ce créneau vient d'être complété. | RG-07 : limite atteinte | `slotId` | Recharger l'événement, garder l'inscription précédente |
| `SLOT_STARTED` | 409 | Ce créneau a commencé. Contacte un administrateur pour modifier ton inscription. | RG-08 : inscription ou désinscription après le début (heure courante supérieure ou égale au début) | `slotId` | Recharger l'événement |
| `SLOT_CAPACITY_BELOW_REGISTRATIONS` | 409 | {registeredCount} personnes sont déjà inscrites : retire des inscrits avant de baisser la limite. | RG-07 : limite abaissée sous le nombre d'inscrits | `registeredCount` | Afficher le message, la limite reste inchangée |
| `REGISTRATION_ALREADY_EXISTS` | 409 | Tu es déjà inscrit à ce créneau. | RG-08 : une seule inscription par utilisateur et créneau | `slotId` | Recharger l'événement |
| `RATE_LIMITED` | 429 | Trop de requêtes, réessaie plus tard. | Limites de débit (`architecture/security.md`, section 4) | | Attendre `Retry-After` |
| `INTERNAL_ERROR` | 500 | Une erreur est survenue. | Bug serveur | | Afficher le `requestId` |
| `SERVICE_UNAVAILABLE` | 503 | Le service est momentanément indisponible. | `/health` : base de données injoignable | | Réessayer plus tard |

## 3. Codes de champ (`VALIDATION_ERROR`, `details.fields[].code`)

Un code de champ ne se rattache pas à un statut HTTP : il explique pourquoi un champ est refusé. Les noms de champ sont ceux du corps de la requête, avec un point pour l'imbrication (`admin.password`, `slots.0.endsAt`).

| Code | Message affiché | Cause / règle |
| --- | --- | --- |
| `FIELD_REQUIRED` | Ce champ est obligatoire. | Champ vide ou absent. Pour `title` : « Le titre est obligatoire » ; pour `firstName`, `lastName`, `email`, le formulaire d'invitation affiche le toast « Renseigne ton nom, ton prénom et une adresse e-mail valide » |
| `FIELD_EMAIL_INVALID` | Renseigne une adresse e-mail valide. | Format d'e-mail incorrect (RG-01) |
| `FIELD_PASSWORD_TOO_SHORT` | Le mot de passe doit contenir au moins 10 caractères. | RG-01 |
| `FIELD_PASSWORD_INCORRECT` | Le mot de passe actuel est incorrect. | RG-18 : mot de passe actuel faux, porté par le champ `currentPassword` |
| `FIELD_DATE_INVALID` | Renseigne une date valide. | Date-heure mal formée |
| `FIELD_END_NOT_AFTER_START` | La fin doit être après le début. | RG-06 (événement), RG-07 (créneau) ; porté par le champ `endsAt` |
| `FIELD_CAPACITY_TOO_LOW` | La limite doit être d'au moins 1 place (ou vide pour illimité). | RG-07 |
| `FIELD_TIMEZONE_INVALID` | Choisis un fuseau horaire de la liste. | RG-16 : valeur absente de la base IANA |
| `FIELD_ROLE_INVALID` | Rôle inconnu. | Valeur autre que `USER` ou `ADMIN` |
| `FIELD_UNKNOWN` | Champ non reconnu. | Champ inattendu dans le corps ; filet de sécurité, pas affiché à l'utilisateur |

## 4. Règles

- Un code ne change jamais de sens ; un code abandonné est marqué « obsolète », pas supprimé.
- Codes en `MAJUSCULES_AVEC_UNDERSCORES`, préfixés par le domaine (`AUTH_`, `USER_`, `EVENT_`, `SLOT_`, `REGISTRATION_`) ; les codes transverses n'ont pas de préfixe (`VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`) ; les codes de champ commencent par `FIELD_`.
- Les messages ne révèlent rien de sensible : jamais « e-mail inconnu » et « mot de passe faux » séparément ; le blocage de connexion est identique que le compte existe ou non (RG-03, ADR-0013).
- Limite connue : `USER_EMAIL_TAKEN` révèle qu'une adresse a un compte, à qui détient un lien d'invitation valide ; risque accepté (`architecture/security.md`).
- Aucun détail technique (trace, SQL, nom de table) dans la réponse, seulement dans les journaux.
- Un événement ou un créneau passé répond « introuvable » à un utilisateur (RG-09) mais `EVENT_PAST` à un administrateur qui tente de le modifier (RG-15).
- Un message avec une valeur variable utilise un paramètre entre accolades, rempli depuis `details` (`{registeredCount}`).
