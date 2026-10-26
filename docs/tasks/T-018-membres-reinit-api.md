# T-018 : Membres, rôles, réinitialisation du mot de passe : services et routes

Jalon : M4 – Invitations et membres  
Fonctionnalités : F-10, F-02  
Dépend de : T-007, T-009  
Taille : une session de travail

## Objectif
Gérer les membres et leurs droits, et réinitialiser un mot de passe par lien.

## À lire avant de commencer
- `user-stories.md` (« Gestion des membres », « Connexion et déconnexion » scénarios 5 et 6)
- `domain/business-rules.md` (RG-01, RG-04, RG-12, RG-14)
- `api/openapi.yaml` (`/users`, `/users/{userId}`, `/users/{userId}/role`, `/users/{userId}/password-resets`, `/password-resets/{token}`)
- `flows/03-reinitialisation-mot-de-passe.mmd`
- `flows/07-admin-membres.mmd`
- `domain/schema.sql` (`reset_tokens`)

## Travail
- Module `members` : liste, fiche, changement de rôle.
- Règle RG-04 atomique : donner `ADMIN` à un autre ; seul l'intéressé retire son droit ; le dernier administrateur ne peut pas se le retirer (`USER_LAST_ADMIN`) ; deux retraits simultanés ne laissent jamais zéro administrateur (verrou ou contrainte).
- Module `auth` : `ResetToken` haché, valable 3 jours, un nouveau lien invalide les précédents ; réinitialisation réussie : `tokenVersion` + 1, blocage RG-03 levé, lien consommé, aucune connexion automatique.
- Routes `GET /users`, `GET /users/{id}`, `PUT /users/{id}/role`, `POST /users/{id}/password-resets`, `GET` et `POST /password-resets/{token}`.

## Critères d'acceptation
- Les scénarios 1 à 8 de « Gestion des membres » et 5 et 6 de « Connexion et déconnexion » passent au niveau API.
- Deux administrateurs qui se retirent leur droit en même temps : un seul réussit, il reste un administrateur.
- Après réinitialisation, une session ouverte avant est refusée (`AUTH_REQUIRED`) et la connexion avec le nouveau mot de passe fonctionne.
- Un lien expiré, déjà utilisé ou remplacé répond `410 AUTH_RESET_LINK_INVALID`.
- Un utilisateur sans droit reçoit `403` sur toutes les routes d'administration.

## Tests attendus
- Unitaire : règles de rôle.
- Intégration : routes, erreurs ; test de concurrence sur le dernier administrateur ; invalidation des sessions.
- Sécurité : accès refusé par route d'administration.

## Hors périmètre
- Interface (T-019), suppression de compte (T-020).

Terminé quand : `definition-of-done.md` est entièrement cochée.
