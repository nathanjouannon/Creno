# Environnements et déploiement – Créno

Statut : version 1.0 (2026-10-26). Découle de `architecture.md`, `security.md` et des ADR 0001, 0002, 0004, 0005, 0006. Les noms de commandes et de scripts sont indicatifs : ils seront fixés à la création du squelette (phase 8).

## 1. Environnements

Deux environnements durables (local et production) et un environnement jetable (intégration continue). Pas de staging : le club est petit et le budget est de 0 € ; les tests avant mise en ligne se font en local et en intégration continue.

| | Local | Intégration continue | Production |
| --- | --- | --- | --- |
| But | Développement | Valider chaque pull request et chaque version | Le club, utilisateurs réels |
| URL | http://localhost:3000 | aucune | `https://` + domaine du club |
| HTTPS | non | non | oui, Caddy avec Let's Encrypt |
| Base de données | PostgreSQL dans Docker (`docker compose`) | PostgreSQL jetable créé pour le test | PostgreSQL dans Docker sur le serveur, sauvegardes chiffrées quotidiennes |
| Données | Jeu de données `seed` (un club, un administrateur, quelques événements) | Données créées par les tests | Réelles, créées par la page d'installation (RG-17) |
| Déploiement | `pnpm dev` | GitHub Actions | Tag `vX.Y.Z`, puis mise à jour manuelle sur le serveur (section 4) |
| Fuseau du club | Choisi à l'installation (RG-16) | Fixé par les tests | Choisi à l'installation |

## 2. Variables d'environnement

Les valeurs ne sont jamais dans le dépôt. Modèle : `.env.example`. Aucune variable d'envoi d'e-mail : l'application n'envoie rien au MVP (RG-13). Le nom du club et son fuseau horaire ne sont pas des variables : ils sont enregistrés en base à l'installation (`Club`).

| Variable | Rôle | Obligatoire | Où elle est définie |
| --- | --- | --- | --- |
| `DATABASE_URL` | Connexion de l'application à PostgreSQL | oui | `.env` (local) / `.env` du serveur |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Création et accès du conteneur PostgreSQL | oui | `.env` (local) / `.env` du serveur |
| `AUTH_SECRET` | Signature des jetons JWT (32 octets aléatoires au minimum, `security.md`) | oui | `.env` du serveur ; valeur de test en local |
| `APP_URL` | Adresse publique de l'application ; sert aux liens d'invitation et de réinitialisation et au contrôle de l'en-tête `Origin` | oui | `.env` |
| `DOMAIN` | Nom de domaine servi par Caddy | oui en production | `.env` du serveur |
| `TRUST_PROXY` | L'application lit l'adresse IP dans l'en-tête posé par Caddy (limites de débit) | oui en production (`true`), non en local | `.env` du serveur |
| `BACKUP_ENCRYPTION_KEY` | Clé **publique** `age` (`age1…`) pour laquelle les sauvegardes sont chiffrées ; la clé privée correspondante n'est jamais sur le serveur | oui en production | `.env` du serveur |
| `LOG_LEVEL` | `debug` en local, `info` en production | non | `.env` |
| `NODE_ENV` | `development` ou `production` | oui | défini par la commande de lancement et l'image |
| `CRENO_VERSION` | Numéro de version des images à lancer (`0.1.0` pour le tag `v0.1.0`) ; jamais `latest` ; `dev` par défaut pour une construction locale | oui en production | `.env` du serveur ; lue par `docker compose`, pas par l'application |

Règles : `.env` est ignoré par Git ; sur le serveur il est en lecture seule pour son propriétaire (droits 600). L'application refuse de démarrer si une variable obligatoire manque ou a un format invalide (vérifié par un schéma Zod au démarrage).

## 3. Chaîne d'intégration continue (GitHub Actions)

1. **À chaque pull request** : installation, vérification que les fichiers générés depuis `tokens.json` et le contrat d'API (`pnpm api:check`, `pnpm api:lint`) sont à jour, lint (dont l'interdiction des valeurs de style en dur, ADR-0010), contrôle des types, tests unitaires, tests d'intégration sur une base PostgreSQL jetable, tests de bout en bout (Playwright, sur la version construite de l'application ; axe y vérifie l'accessibilité), test des migrations (voir section 6), audit des dépendances, scan de secrets.
2. **Merge sur `main`** : mêmes étapes, plus la construction de l'image Docker (non publiée).
3. **Tag `vX.Y.Z`** : mêmes étapes, puis publication de l'image sur GitHub Container Registry (`ghcr.io`, gratuit) sous le nom de version, jamais `latest`, et création des notes de version.

Mise en œuvre : `.github/workflows/ci.yml`. Tâches : qualité et tests unitaires, intégration et migrations (PostgreSQL 16.4 jetable), scan de secrets (gitleaks sur tout l'historique), audit des dépendances (`pnpm audit --audit-level high`, exceptions justifiées dans `package.json`, `pnpm.auditConfig`), puis l'image. Les tests de bout en bout (`End-to-end tests`) créent leur propre base `creno_e2e`. Deux images sont publiées pour un tag : `creno` (application) et `creno-migrate` (service de migration).

Une pull request ne peut être fusionnée que si toutes les étapes sont vertes. Les mises à jour de dépendances sont proposées automatiquement (Dependabot) et passent par la même chaîne.

## 4. Mise en production

Mise à jour manuelle, après validation humaine d'une version publiée (décision du 2026-10-26).

1. Sauvegarde automatique de la base, juste avant la mise à jour (section 5).
2. Sur le serveur : changer `CRENO_VERSION` dans `.env`, puis récupérer les images (`docker compose pull`).
3. Appliquer les migrations de base (service `migrate` du `docker compose`, exécuté une fois).
4. Redémarrer l'application (`docker compose up -d`).
5. Vérifier `/health` et ouvrir une page de l'application.

La procédure complète, avec les commandes exactes, est écrite dans `README.md` (« Mettre à jour », « Revenir en arrière »). Le script `deploy/update.sh <version>` enchaîne les étapes 1 à 5.

**Première mise en service d'une instance** : `docker compose up -d`, puis ouvrir l'adresse du club et remplir la page d'installation (club et premier administrateur) tout de suite après le déploiement (RG-17, ADR-0012).

**Commandes clés** (noms indicatifs)
- Installer : `pnpm install` ; lancer : `pnpm dev`
- Base locale : `docker compose up -d db`, puis `pnpm db:migrate` et `pnpm db:seed`
- Style : `pnpm tokens:build` (régénère les fichiers depuis `tokens.json`)
- Qualité : `pnpm lint`, `pnpm typecheck`, `pnpm test`

## 5. Reverse proxy, sauvegardes, supervision

**Reverse proxy : Caddy.** Il termine le HTTPS (certificats Let's Encrypt automatiques), redirige le HTTP vers le HTTPS et pose les en-têtes de `security.md` (HSTS, CSP, `nosniff`, `Referrer-Policy`, `frame-ancestors`). Les limites de débit par adresse IP sont appliquées par l'application, ce qui évite un module Caddy supplémentaire et suffit pour une seule instance. Caddy transmet l'adresse IP du client dans un en-tête lu quand `TRUST_PROXY` vaut `true`.

**Sauvegardes**
- Une sauvegarde par jour par `pg_dump` (format `custom`), chiffrée avec **`age`** pour la clé publique `BACKUP_ENCRYPTION_KEY`, conservée sur le serveur dans `backups/` (décision du 2026-10-26) : 7 jours glissants, plus la première de chaque mois gardée 12 mois (`backups/monthly/`). Script : `deploy/backup.sh`, lancé chaque nuit par `cron` (commande dans `README.md`).
- Une sauvegarde supplémentaire (`pre-update`) est faite automatiquement par `deploy/update.sh` avant chaque mise à jour, donc avant chaque migration de production.
- Choix de la clé publique : le serveur peut chiffrer mais pas déchiffrer. Une personne qui vole le serveur ou ses sauvegardes n'obtient pas les données. La clé privée (fichier produit par `age-keygen`) est gardée par le porteur du projet, dans son gestionnaire de mots de passe, et n'est fournie qu'au moment d'une restauration.
- Perte de données maximale 24 h, restauration en moins de 4 h (`architecture.md`). Mesure du 2026-10-28 sur une base d'essai (migrations + jeu de données `seed`) : 5 s, déchiffrement compris. Le temps réel est dominé par l'accès au serveur et la récupération de la clé privée.
- Restauration (`deploy/restore.sh <sauvegarde> <clé-privée>`) : arrête l'application, déchiffre, recharge dans PostgreSQL (`pg_restore --clean`), redémarre ; puis vérifier `/health`. Avec `RESTORE_DB=<nom>`, la sauvegarde est rechargée dans une autre base jetable sans toucher à la production : c'est le test à faire avant la première mise en service, puis tous les 6 mois.

**Purge planifiée** : `login_attempts` sans blocage depuis plus de 24 h et `reset_tokens` expirés ou utilisés depuis plus de 30 jours (`security.md`, section 4). Le service `purge` de `docker-compose.yml` (profil `tools`, image `creno-migrate`, commande `pnpm db:purge`) est lancé chaque nuit par `cron` ; il écrit une ligne de journal avec le nombre de lignes supprimées. Aucune file ni tâche de fond dans l'application.

**Supervision**
- `/health` répond 200 si l'application et la base répondent. Un service externe gratuit l'interroge toutes les 5 minutes et envoie une alerte en cas d'arrêt.
- Journaux JSON sur la sortie standard, rotation Docker (10 Mo sur 5 fichiers par conteneur, réglée dans `docker-compose.yml`) ; format et contenu dans `security.md`.
- Espace disque : `deploy/backup.sh` affiche le remplissage du disque à chaque sauvegarde (visible dans le journal de `cron`) ; la base et les sauvegardes sont sur le même serveur.

**Maintenance** : versions d'images fixées (jamais `latest`, version majeure de PostgreSQL fixée), mises à jour du système du serveur chaque mois, correctifs de sécurité des dépendances par Dependabot.

## 6. Migrations et retour arrière

Décision du 2026-10-26 : les migrations de base sont des scripts SQL versionnés avec un script de retour écrit à la main.

- Chaque migration comprend un script d'application et un script de retour (par exemple `up.sql` et `down.sql`), relus ensemble dans la pull request.
- La commande de retour (`pnpm db:rollback`, nom indicatif) exécute le script de retour de la dernière migration. Outil : Prisma Migrate avec fichiers SQL personnalisés et `down.sql` écrit à la main (ADR-0015).
- L'intégration continue applique chaque migration, la défait, puis la rejoue sur une base jetable, pour vérifier que le retour fonctionne.
- Une migration qui détruit des données (suppression de colonne ou de table) est marquée irréversible : son retour est une restauration de la sauvegarde d'avant la mise à jour.
- En cas d'incident en production après une mise à jour : défaire la migration si elle est réversible, redéployer l'image de la version précédente, vérifier `/health` ; sinon restaurer la sauvegarde prise avant la mise à jour.

## 7. Points à confirmer

- Domaine du club et hébergeur du serveur (VPS ou Raspberry).
- Service d'alerte de disponibilité gratuit retenu par le club (voir `README.md`) ; copie des sauvegardes hors serveur (`security.md`).
- Gestionnaire de paquets : pnpm (proposé dans `architecture.md`).
