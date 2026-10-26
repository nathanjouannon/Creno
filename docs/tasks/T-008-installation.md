# T-008 : Installation de l'instance : club et premier administrateur

Jalon : M1 – Installation, connexion et accès  
Fonctionnalités : F-19  
Dépend de : T-002, T-004, T-007  
Taille : une session de travail

## Objectif
Permettre de créer le club et le premier administrateur sur une instance neuve, une seule fois.

## À lire avant de commencer
- `user-stories.md` (« Installation de l'instance »)
- `domain/business-rules.md` (RG-01, RG-04, RG-16, RG-17)
- `adr/0012-page-installation-et-club.md`
- `flows/09-installation.mmd`
- `api/openapi.yaml` (`/setup`, `/club`)
- `design/wireframes/01-authentification-*` (A10, A11)
- `design/components.md` (InstallForm)

## Travail
- Module `club` : service d'installation transactionnel, un seul gagnant en cas d'installations simultanées (contrainte `club.id = 1` ou verrou), création du `Club` et de l'administrateur, session ouverte.
- `POST /setup` et `GET /club` conformes au contrat ; `404 NOT_FOUND` dès qu'un utilisateur existe.
- Redirection de toutes les pages vers la page d'installation tant que l'instance n'est pas installée ; page d'installation (A10, A11) introuvable ensuite.
- Validation du fuseau horaire IANA (`FIELD_TIMEZONE_INVALID`).

## Critères d'acceptation
- Les 5 scénarios de « Installation de l'instance » passent.
- Deux `POST /setup` en parallèle : un seul `201`, un seul club, un seul administrateur, l'autre reçoit `404`.
- Avant installation, l'URL d'un événement ou de la connexion redirige vers l'installation.
- L'administrateur créé arrive connecté sur la liste des événements, qui affiche « Aucun événement à venir pour le moment » (la page de liste complète vient de T-013 et T-015 : une page provisoire suffit).

## Tests attendus
- Intégration : installation réussie, champs invalides, seconde installation, concurrence.
- E2E (Playwright) : scénarios 1 à 4 de la story.

## Hors périmètre
- Liste des événements complète (T-013, T-015).

Terminé quand : `definition-of-done.md` est entièrement cochée.
