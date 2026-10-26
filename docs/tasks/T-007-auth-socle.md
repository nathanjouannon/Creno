# T-007 : Authentification : mots de passe, JWT, session, protections

Jalon : M1 – Installation, connexion et accès  
Fonctionnalités : F-02, F-03  
Dépend de : T-004  
Taille : une session de travail

## Objectif
Mettre en place les mécanismes d'authentification et de protection partagés par toutes les routes.

## À lire avant de commencer
- `adr/0006-authentification-jwt-verifie-en-base.md`
- `architecture/security.md` (sections 1, 2 et 4)
- `api/openapi.yaml` (`cookieAuth`, `/me`, `/auth/logout`)
- `api/errors.md`
- `domain/business-rules.md` (RG-01, RG-14)

## Travail
- Hachage argon2id (paramètres minimums OWASP, à fixer ici et consigner dans `security.md`, section 5) ; comparaison à temps constant.
- JWT signé avec `AUTH_SECRET`, cookie `__Host-session` (`HttpOnly`, `Secure`, `SameSite=Lax`, chemin `/`, 30 jours). Le cookie `__Host-` exigeant `Secure`, prévoir une exception de développement documentée sur http://localhost.
- Résolution de la session à chaque requête : signature, expiration, lecture de l'utilisateur en base, comparaison de `tokenVersion` ; le rôle utilisé est celui de la base. Brancher l'enveloppe de T-004 (`AUTH_REQUIRED`, `FORBIDDEN`).
- Contrôle de l'en-tête `Origin` sur les requêtes qui modifient des données (`FORBIDDEN_ORIGIN`).
- Limites de débit par adresse IP (10 par minute sur `/setup`, `/auth/login`, `/password-resets/*`, `/invitations/*` ; 100 par minute ailleurs), `429 RATE_LIMITED` avec `Retry-After`, adresse lue selon `TRUST_PROXY`.
- `POST /auth/logout` et `GET /me`.

## Critères d'acceptation
- Un jeton expiré, signé avec une autre clé, d'un utilisateur supprimé ou avec un `tokenVersion` périmé donne `401 AUTH_REQUIRED`.
- Le rôle d'un utilisateur modifié en base s'applique à sa requête suivante, sans nouvelle connexion.
- Une requête `POST` avec un `Origin` étranger est refusée.
- La 11e requête de connexion en une minute depuis la même adresse reçoit `429` ; une adresse envoyée par un client dans un en-tête n'est pas crue si `TRUST_PROXY` est faux.
- Le mot de passe n'apparaît dans aucun journal ni réponse.

## Tests attendus
- Unitaire : hachage, signature et vérification des jetons.
- Intégration : chaque refus ci-dessus, déconnexion, `/me`.
- Sécurité : un test d'accès refusé par route d'administration existante (le modèle est posé ici, étendu à chaque ticket de route).

## Hors périmètre
- Connexion avec blocage (T-009), installation (T-008).

Terminé quand : `definition-of-done.md` est entièrement cochée.
