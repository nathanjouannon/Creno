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
   - `TRUST_PROXY=true`, `LOG_LEVEL=info` ;
   - `BACKUP_ENCRYPTION_KEY` : la clé **publique** `age` (voir « Sauvegardes ») ;
   - `CRENO_VERSION` : le numéro de la version publiée, par exemple `0.1.0` pour le tag `v0.1.0`.
3. `docker compose up -d` : PostgreSQL démarre, le service `migrate` applique les migrations une fois, puis l'application et Caddy (HTTPS automatique, redirection du HTTP) démarrent.
4. Vérifier : `curl https://<domaine>/health` répond `{"status":"ok"}`.
5. Ouvrir l'adresse dans un navigateur et remplir tout de suite la page d'installation (club et premier administrateur, RG-17).

**Mettre à jour** : `deploy/update.sh 0.2.0` (version = tag sans le `v`). Le script fait une sauvegarde `pre-update`, change `CRENO_VERSION` dans `.env`, récupère les images, démarre (le service `migrate` s'exécute avant l'application) et interroge `/health`. Équivalent à la main : `deploy/backup.sh pre-update`, modifier `CRENO_VERSION`, `docker compose pull`, `docker compose up -d --wait`, `curl https://<domaine>/health`.

**Revenir en arrière** (incident après une mise à jour ; `X` = version précédente, `Y` = version installée) :

1. Si la mise à jour contenait une migration réversible : `docker compose run --rm migrate pnpm db:rollback` (avec `CRENO_VERSION=Y` encore dans `.env`, car le script de retour est dans l'image `Y`). Elle défait la dernière migration. Répéter pour chaque migration de la version, de la plus récente à la plus ancienne.
2. Mettre `CRENO_VERSION=X` dans `.env`, puis `docker compose pull && docker compose up -d`.
3. Vérifier `curl https://<domaine>/health` et ouvrir une page.
4. Si une migration détruit des données (marquée irréversible dans sa pull request) : à la place de l'étape 1, restaurer la sauvegarde `pre-update` (voir « Restaurer »), puis faire l'étape 2.

## Sauvegardes, restauration, purge et supervision

Détails et choix : `docs/architecture/environments.md`, section 5.

**Préparer le chiffrement (une fois, sur votre ordinateur, pas sur le serveur)**

1. Installer `age` (`brew install age`, `apt install age`), puis `age-keygen -o creno-backup.key`. La ligne `# public key: age1…` s'affiche : c'est la valeur de `BACKUP_ENCRYPTION_KEY`.
2. Ranger `creno-backup.key` (la clé **privée**) dans un gestionnaire de mots de passe et en garder une deuxième copie ailleurs. Sans elle, les sauvegardes sont illisibles ; le serveur ne l'a jamais.
3. Sur le serveur, installer aussi `age` (le script chiffre avec la clé publique).

**Planifier (sur le serveur, `crontab -e`, depuis le dossier du dépôt)**

```
15 3 * * * cd /opt/creno && deploy/backup.sh >> /var/log/creno-backup.log 2>&1
45 3 * * * cd /opt/creno && docker compose --profile tools run --rm purge >> /var/log/creno-purge.log 2>&1
```

La première ligne crée une sauvegarde `backups/creno-<date>-daily.dump.age` : 7 jours conservés, plus la première de chaque mois pendant 12 mois (`backups/monthly/`). La seconde supprime les tentatives de connexion sans blocage depuis plus de 24 h et les jetons de réinitialisation expirés ou utilisés depuis plus de 30 jours.

**Restaurer** (perte ou corruption de la base) : copier la clé privée sur le serveur le temps de l'opération, puis

```
deploy/restore.sh backups/creno-<date>-daily.dump.age /chemin/creno-backup.key
curl https://<domaine>/health
```

puis supprimer la clé privée du serveur. Le script arrête l'application, recharge la base et redémarre. **Tester sans risque** (à faire avant la première mise en service, puis tous les 6 mois) : `RESTORE_DB=creno_essai deploy/restore.sh <sauvegarde> <clé>` recharge la sauvegarde dans une base d'essai sans toucher à la production ; la vérifier avec `docker compose exec db psql -U <POSTGRES_USER> -d creno_essai -c "select count(*) from users"`, puis `docker compose exec db dropdb -U <POSTGRES_USER> creno_essai`.

**Alerte de disponibilité** : créer un moniteur gratuit (par exemple UptimeRobot, offre gratuite) de type HTTP(s) sur `https://<domaine>/health`, intervalle 5 minutes, alerte par e-mail à un responsable. `/health` répond 200 si l'application et la base répondent, 503 sinon.

**Journaux** : chaque conteneur garde au plus 5 fichiers de 10 Mo (`docker-compose.yml`) ; lire avec `docker compose logs --tail 100 app`. Aucun mot de passe, jeton ni e-mail complet n'y figure.

**Essayer en local sans publier** : `docker compose build`, puis `docker compose up -d` avec un `.env` dont `DOMAIN=localhost`, `APP_URL=https://localhost`, `TRUST_PROXY=true` et `BACKUP_ENCRYPTION_KEY` rempli ; ouvrir `https://localhost/health` (certificat local de Caddy, à accepter).

## Intégration continue et versions

La chaîne `.github/workflows/ci.yml` s'exécute sur chaque pull request et chaque fusion dans `main` : fichiers générés à jour (tokens, `pnpm api:check`), lint, types, tests unitaires, tests d'intégration sur PostgreSQL jetable (dont migration appliquée, défaite, rejouée), scan de secrets (gitleaks), audit des dépendances. Sur `main`, l'image Docker est aussi construite (non publiée).

**Publier une version** : créer un tag `vX.Y.Z` sur `main` (`git tag v0.1.0 && git push origin v0.1.0`). La chaîne publie les images `ghcr.io/<propriétaire>/creno:X.Y.Z` et `ghcr.io/<propriétaire>/creno-migrate:X.Y.Z` (jamais `latest`) et crée les notes de version. Si le paquet est privé, `docker login ghcr.io` est nécessaire sur le serveur ; sinon, le rendre public dans les réglages du paquet.

**Protéger `main`** (réglage GitHub, à faire une fois par le propriétaire du dépôt) : Settings → Branches → Add branch ruleset (ou règle de protection) sur `main`, avec :

- _Require a pull request before merging_ (une approbation) ;
- _Require status checks to pass_ : `Quality and unit tests`, `Integration tests and migrations`, `End-to-end tests`, `Secret scan`, `Dependency audit` ;
- _Require branches to be up to date before merging_ ;
- _Block force pushes_ et _Restrict deletions_.

Dependabot propose chaque semaine les mises à jour npm (groupées) et chaque mois celles des actions GitHub et des images Docker ; elles passent par la même chaîne.
