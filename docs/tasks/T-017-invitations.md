# T-017 : Invitations : lien, création de compte

Jalon : M4 – Invitations et membres  
Fonctionnalités : F-01  
Dépend de : T-008, T-011, T-010  
Taille : une session de travail

## Objectif
Un administrateur invite des bénévoles par un lien ; ils créent leur compte.

## À lire avant de commencer
- `user-stories.md` (« Invitation et création de compte »)
- `domain/business-rules.md` (RG-01, RG-02)
- `flows/01-invitation-creation-compte.mmd`
- `api/openapi.yaml` (`/events/{eventId}/invitations`, `/invitations/{token}`)
- `design/wireframes/01-authentification-*` (A1 à A4), 03-admin-evenements-* (C3)
- `architecture/security.md` (menaces « lien d'invitation »)

## Travail
- Module `invitations` : jeton aléatoire fort stocké haché, URL construite avec `APP_URL`, validité calculée sur le début actuel de l'événement.
- `POST /events/{id}/invitations` (`EVENT_STARTED` si commencé), `GET /invitations/{token}`, `POST /invitations/{token}` : création de l'utilisateur `USER` actif, session ouverte, `eventId` renvoyé.
- E-mail unique sans casse (`USER_EMAIL_TAKEN`) ; mot de passe d'au moins 10 caractères.
- Interface : bouton « Inviter des bénévoles » (masqué si l'événement a commencé) et LinkDialog (C3) ; page de création de compte (A1 à A4) ; connexion après invitation vers l'événement (scénario 5 bis).
- Supprimer l'événement invalide ses invitations.

## Critères d'acceptation
- Les scénarios 1, 1 bis, 2, 3, 4, 5, 5 bis, 6 et 7 de « Invitation et création de compte » passent.
- Un lien reporté avec l'événement reste valable jusqu'au nouveau début.
- Deux comptes créés avec le même lien et des adresses différentes sont possibles ; la même adresse en casse différente est refusée.
- Le jeton n'apparaît pas en clair en base ni dans les journaux.

## Tests attendus
- Unitaire : validité avec horloge injectée.
- Intégration : routes, erreurs, concurrence sur l'e-mail unique.
- E2E : parcours complet sur 360 px (création de compte en moins de 2 minutes, mesure manuelle).

## Hors périmètre
- Connexion externe Google, Facebook, Apple (après le MVP).

Terminé quand : `definition-of-done.md` est entièrement cochée.
