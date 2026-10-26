# T-014 : Inscriptions : services et routes, concurrence

Jalon : M3 – Inscriptions (bénévole) et suivi du remplissage  
Fonctionnalités : F-06, F-07, F-08  
Dépend de : T-011, T-012  
Taille : une session de travail

## Objectif
Inscrire, désinscrire et retirer un inscrit, sans jamais dépasser une limite de places.

## À lire avant de commencer
- `user-stories.md` (F-06, F-07, F-08)
- `domain/business-rules.md` (RG-07, RG-08, RG-09, RG-11, RG-15)
- `api/openapi.yaml` (`/slots/{slotId}/registrations`, `/slots/{slotId}/registrations/me`, `/registrations/{registrationId}`, `Attendee`)
- `architecture/architecture.md` (section 5)
- `api/errors.md`

## Travail
- Fixer et justifier le mécanisme de verrouillage de RG-07 (transaction sérialisable avec nouvelle tentative, verrou de ligne ou verrou consultatif ; un SQL brut demande une exception écrite à `security.md`) en le validant par le test de 50 requêtes, puis remplacer les extraits de `examples.md` (sections 1 à 5) par des renvois vers le code réel.
- Module `registrations` : `register`, `unregister`, `removeRegistration` (administrateur).
- Dernière place attribuée une seule fois : verrou de ligne ou contrainte dans une transaction.
- Refus : `SLOT_FULL`, `SLOT_STARTED` (heure courante supérieure ou égale au début), `REGISTRATION_ALREADY_EXISTS`, `EVENT_PAST` pour un administrateur ; événement passé introuvable pour un utilisateur.
- Le retrait par un administrateur reste possible sur un créneau commencé tant que l'événement n'est pas passé.
- Les `attendees` du `Slot` : « Prénom N. » (RG-09), `null` pour une inscription anonymisée, `isMe`, `registrationId`.

## Critères d'acceptation
- Les scénarios 1 à 5 de F-07 et 1 à 4 de F-08 passent au niveau API ; les scénarios 5 et 6 de F-09 passent pour le retrait.
- 50 `POST` simultanés sur un créneau limité à 4 avec 3 inscrits : exactement un `201`, 49 `409 SLOT_FULL`, 4 inscrits.
- Inscription à 09:00:00 précises d'un créneau commençant à 09:00 : refusée.
- Un utilisateur ne peut pas retirer l'inscription d'un autre (`403 FORBIDDEN`).
- Le chevauchement de deux créneaux est accepté (RG-08).

## Tests attendus
- Unitaire : règles d'état avec horloge injectée.
- Intégration : toutes les routes ; test de concurrence sur la dernière place (`testing.md`, section 4).
- Sécurité : accès refusé par route d'administration.

## Hors périmètre
- Inscription par un administrateur (F-12, v1.1).

Terminé quand : `definition-of-done.md` est entièrement cochée.
