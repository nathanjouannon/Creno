# T-011 : Événements : services et routes

Jalon : M2 – Événements et créneaux (administrateur)  
Fonctionnalités : F-04  
Dépend de : T-004, T-005, T-007  
Taille : une session de travail

## Objectif
Implémenter la gestion des événements côté serveur, avec leurs états calculés.

## À lire avant de commencer
- `user-stories.md` (« Créer, modifier, supprimer un événement »)
- `domain/business-rules.md` (RG-06, RG-09, RG-10, RG-14, RG-15, RG-16)
- `api/openapi.yaml` (`/events`, `/events/{eventId}`)
- `api/errors.md`
- `glossary.md` (états dans le temps)
- `domain/schema.sql` (`events`)

## Travail
- Module `events` : services et dépôts ; `status` (`upcoming`, `ongoing`, `past`) calculé avec l'horloge injectée.
- `GET /events` (`scope=upcoming|past`, `past` réservé aux administrateurs), `POST /events` (avec créneaux facultatifs, création atomique), `GET /events/{id}`, `PATCH /events/{id}`, `DELETE /events/{id}`.
- Événement passé : `404 EVENT_NOT_FOUND` pour un utilisateur, `409 EVENT_PAST` à la modification ou suppression par un administrateur (RG-15).
- Les créneaux créés avec l'événement suivent la validation de `SlotInput` (la logique de capacité vient de T-012 : réutiliser son service, ou créer le créneau sans contrainte de capacité ici et la brancher dans T-012).

## Critères d'acceptation
- Les scénarios 1, 2, 3, 3 bis, 4, 5, 6, 7 et 8 de « Créer, modifier, supprimer un événement » passent au niveau API (la confirmation de suppression est à l'interface : T-013).
- Un utilisateur sans droit reçoit `403 FORBIDDEN` sur `POST`, `PATCH` et `DELETE` ; l'événement n'est pas modifié.
- Un événement dont la fin est dépassée est absent de `scope=upcoming`, introuvable pour un utilisateur, visible d'un administrateur dans `scope=past`.
- Dates stockées en UTC, renvoyées en ISO 8601 UTC.
- La réponse est conforme au schéma `EventDetail`.

## Tests attendus
- Unitaire : calcul de `status` aux frontières (début exact, fin exacte).
- Intégration : chaque route, chaque rôle, chaque erreur du contrat.
- Sécurité : accès refusé à un utilisateur sur chaque route d'administration.

## Hors périmètre
- Interface (T-013).

Terminé quand : `definition-of-done.md` est entièrement cochée.
