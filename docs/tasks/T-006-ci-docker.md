# T-006 : Image Docker, compose de production et intégration continue

Jalon : M0 – Squelette qui tourne de bout en bout  
Fonctionnalités : —  
Dépend de : T-002, T-003, T-005  
Taille : une session de travail

## Objectif
Pouvoir construire, tester et publier l'application, et la lancer par `docker compose up`.

## À lire avant de commencer
- `architecture/environments.md` (sections 1 à 5)
- `architecture/security.md` (sections 2 et 4)
- `adr/0004-deploiement-docker-vps.md`
- `testing.md`

## Travail
- `Dockerfile` multi-étapes, utilisateur non root ; `docker-compose.yml` de production : application, PostgreSQL, Caddy (HTTPS, en-têtes de sécurité de `security.md`), service `migrate` exécuté une fois.
- Workflows GitHub Actions : à chaque pull request (installation, tokens à jour, `api:check`, lint, types, tests unitaires, tests d'intégration sur PostgreSQL jetable, migration appliquée-défaite-rejouée, scan de secrets, audit des dépendances) ; sur `main`, la même chaîne plus la construction de l'image ; sur tag `vX.Y.Z`, publication sur `ghcr.io`.
- Dependabot ; modèle de pull request reprenant `definition-of-done.md`.
- Mettre à jour `.env.example` et `environments.md` si une variable est ajoutée.

## Critères d'acceptation
- Une pull request avec une faute de lint, un schéma Zod modifié sans régénération ou un secret factice fait échouer la chaîne.
- `docker compose up -d` (avec un `.env` d'exemple) lance l'application derrière Caddy et `/health` répond 200.
- L'image est publiée sous le numéro de version, jamais `latest`.
- La branche `main` est protégée : fusion seulement si tout est vert (réglage GitHub à documenter dans le README).

## Tests attendus
- La chaîne elle-même est la preuve : une branche d'essai avec chaque cas d'échec ci-dessus, non fusionnée.

## Hors périmètre
- Déploiement en production et sauvegardes (T-022).

Terminé quand : `definition-of-done.md` est entièrement cochée.
