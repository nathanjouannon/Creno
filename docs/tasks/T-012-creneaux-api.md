# T-012 : Créneaux : services et routes

Jalon : M2 – Événements et créneaux (administrateur)  
Fonctionnalités : F-05  
Dépend de : T-011  
Taille : une session de travail

## Objectif
Implémenter les créneaux, la capacité et leurs états calculés.

## À lire avant de commencer
- `user-stories.md` (« Créneaux et nombre de places »)
- `domain/business-rules.md` (RG-07, RG-10, RG-15)
- `api/openapi.yaml` (`/events/{eventId}/slots`, `/slots/{slotId}`, schéma `Slot`)
- `api/errors.md`
- `domain/schema.sql` (`slots`, `registrations`)

## Travail
- Module `slots` : `registeredCount`, `remainingPlaces`, `full`, `started` calculés (jamais stockés).
- `POST /events/{id}/slots`, `PATCH /slots/{id}`, `DELETE /slots/{id}`.
- Capacité : `null` = illimité ; au moins 1 ; jamais abaissée sous le nombre d'inscrits, vérification atomique avec une inscription concurrente (`SLOT_CAPACITY_BELOW_REGISTRATIONS`).
- Un créneau peut sortir des dates de l'événement : aucun refus.
- Supprimer le dernier créneau conserve l'événement.

## Critères d'acceptation
- Les scénarios 1, 3, 3 bis, 3 ter, 4, 5, 6, 7 et 8 de « Créneaux et nombre de places » passent au niveau API (le scénario 2 vient de T-014).
- Abaisser la limite de 8 à 3 avec 5 inscrits renvoie `409` avec `details.registeredCount = 5`.
- `capacity = 0` renvoie `400` avec `FIELD_CAPACITY_TOO_LOW`.
- Modifier ou supprimer un créneau d'un événement passé renvoie `409 EVENT_PAST`.

## Tests attendus
- Unitaire : états calculés (limité, illimité, complet, vide, commencé à l'instant exact).
- Intégration : toutes les routes et erreurs ; concurrence entre changement de limite et inscription (le test complet est dans T-014).

## Hors périmètre
- Inscriptions (T-014), interface (T-013).

Terminé quand : `definition-of-done.md` est entièrement cochée.
