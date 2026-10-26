# T-009 : Connexion, déconnexion et blocage par adresse saisie

Jalon : M1 – Installation, connexion et accès  
Fonctionnalités : F-02  
Dépend de : T-007  
Taille : une session de travail

## Objectif
Se connecter et se déconnecter, avec le blocage de 15 minutes après 5 échecs consécutifs.

## À lire avant de commencer
- `user-stories.md` (« Connexion et déconnexion », scénarios 1 à 4 et variantes)
- `domain/business-rules.md` (RG-03)
- `adr/0013-blocage-connexion-par-adresse.md`
- `flows/02-connexion-deconnexion.mmd`
- `api/openapi.yaml` (`/auth/login`)
- `design/wireframes/01-authentification-*` (A5 à A7)
- `domain/schema.sql` (`login_attempts`)

## Travail
- Module `auth` : `login` avec `LoginAttempt` indexé par l'empreinte de l'e-mail normalisé, compteur, `lockedUntil`, remise à zéro après une connexion réussie ; les tentatives pendant le blocage ne le prolongent pas.
- Réponse identique pour une adresse sans compte (même message, même durée : hacher un mot de passe factice).
- Mise à jour atomique du compteur (deux échecs simultanés ne perdent pas de comptage).
- `POST /auth/login` (`401`, `423` avec `details.lockedUntil`).
- Page de connexion (A5 à A7), retour à la page demandée, bouton « Se déconnecter » dans l'en-tête provisoire.

## Critères d'acceptation
- Les scénarios 1, 1 bis, 2, 3, 3 bis, 3 ter et 4 de « Connexion et déconnexion » passent.
- La 6e tentative avec le bon mot de passe est bloquée ; une adresse inexistante reçoit exactement la même réponse.
- Un compte supprimé reçoit `AUTH_INVALID_CREDENTIALS`.
- L'e-mail saisi n'est jamais stocké en clair dans `login_attempts`.

## Tests attendus
- Unitaire : calcul du blocage avec une horloge injectée (avant, pendant, après 15 minutes).
- Intégration : mêmes cas via l'API, concurrence sur le compteur.
- E2E : scénarios 1, 2, 3 et 4.

## Hors périmètre
- Réinitialisation du mot de passe (T-018, T-019).

Terminé quand : `definition-of-done.md` est entièrement cochée.
