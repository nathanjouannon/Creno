# Créno

Application web d'organisation de bénévoles pour les associations : l'administrateur publie des événements avec des créneaux, les bénévoles s'y inscrivent.

## Prérequis

- Node.js 20.19 ou plus
- pnpm 10 (`corepack enable`)
- Docker (base PostgreSQL locale et mise en production)

## Commandes

| But           | Commande                                                            |
| ------------- | ------------------------------------------------------------------- |
| Installer     | `pnpm install`                                                      |
| Configurer    | copier `.env.example` en `.env` et remplir les valeurs              |
| Lancer        | `pnpm dev` (http://localhost:3000)                                  |
| Qualité       | `pnpm lint`, `pnpm typecheck`                                       |
| Base locale   | `docker compose up -d db`, puis `pnpm db:migrate` et `pnpm db:seed` |
| Tests         | `pnpm test` (`test:unit`, `test:integration`)                       |
| Contrat d'API | `pnpm api:generate`, `pnpm api:check`, `pnpm api:lint`              |

L'application refuse de démarrer si une variable d'environnement obligatoire manque ou est invalide (`docs/architecture/environments.md`).

La documentation complète est dans `docs/` ; le plan de développement dans `docs/roadmap.md`.

## Mise en production

Une instance = une association. Prérequis : un serveur avec Docker et Docker Compose, un nom de domaine dont l'adresse pointe vers ce serveur, les ports 80 et 443 ouverts.

1. Récupérer le dépôt (ou seulement `docker-compose.yml` et `deploy/Caddyfile`) sur le serveur.
2. Copier `.env.example` en `.env`, le remplir (droits `chmod 600 .env`) :
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` : choisir une valeur, le mot de passe sans caractère spécial d'URL (`@ : / ? #`) ;
   - `DATABASE_URL` : inutilisée par `docker compose` (il la construit), à remplir pour le travail local ;
   - `AUTH_SECRET` : 32 octets aléatoires au minimum (`openssl rand -base64 48`) ;
   - `DOMAIN` (par exemple `benevoles.mon-club.fr`) et `APP_URL` (`https://` + domaine) ;
   - `TRUST_PROXY=true`, `BACKUP_ENCRYPTION_KEY` (à garder aussi hors du serveur), `LOG_LEVEL=info` ;
   - `CRENO_VERSION` : le numéro de la version publiée, par exemple `0.1.0` pour le tag `v0.1.0`.
3. `docker compose up -d` : PostgreSQL démarre, le service `migrate` applique les migrations une fois, puis l'application et Caddy (HTTPS automatique, redirection du HTTP) démarrent.
4. Vérifier : `curl https://<domaine>/health` répond `{"status":"ok"}`.
5. Ouvrir l'adresse dans un navigateur et remplir tout de suite la page d'installation (club et premier administrateur, RG-17).

**Mettre à jour** : changer `CRENO_VERSION` dans `.env`, `docker compose pull`, `docker compose up -d` (le service `migrate` s'exécute avant l'application), vérifier `/health`. Les sauvegardes et la restauration sont décrites dans `docs/architecture/environments.md` (section 5).

**Essayer en local sans publier** : `docker compose build`, puis `docker compose up -d` avec un `.env` dont `DOMAIN=localhost`, `APP_URL=https://localhost`, `TRUST_PROXY=true` et `BACKUP_ENCRYPTION_KEY` rempli ; ouvrir `https://localhost/health` (certificat local de Caddy, à accepter).

## Intégration continue et versions

La chaîne `.github/workflows/ci.yml` s'exécute sur chaque pull request et chaque fusion dans `main` : fichiers générés à jour (tokens, `pnpm api:check`), lint, types, tests unitaires, tests d'intégration sur PostgreSQL jetable (dont migration appliquée, défaite, rejouée), scan de secrets (gitleaks), audit des dépendances. Sur `main`, l'image Docker est aussi construite (non publiée).

**Publier une version** : créer un tag `vX.Y.Z` sur `main` (`git tag v0.1.0 && git push origin v0.1.0`). La chaîne publie les images `ghcr.io/<propriétaire>/creno:X.Y.Z` et `ghcr.io/<propriétaire>/creno-migrate:X.Y.Z` (jamais `latest`) et crée les notes de version. Si le paquet est privé, `docker login ghcr.io` est nécessaire sur le serveur ; sinon, le rendre public dans les réglages du paquet.

**Protéger `main`** (réglage GitHub, à faire une fois par le propriétaire du dépôt) : Settings → Branches → Add branch ruleset (ou règle de protection) sur `main`, avec :

- _Require a pull request before merging_ (une approbation) ;
- _Require status checks to pass_ : `Quality and unit tests`, `Integration tests and migrations`, `Secret scan`, `Dependency audit` ;
- _Require branches to be up to date before merging_ ;
- _Block force pushes_ et _Restrict deletions_.

Dependabot propose chaque semaine les mises à jour npm (groupées) et chaque mois celles des actions GitHub et des images Docker ; elles passent par la même chaîne.
