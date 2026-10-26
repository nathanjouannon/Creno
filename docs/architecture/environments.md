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
| `BACKUP_ENCRYPTION_KEY` | Chiffrement des sauvegardes | oui en production | `.env` du serveur, copie conservée hors du serveur |
| `LOG_LEVEL` | `debug` en local, `info` en production | non | `.env` |
| `NODE_ENV` | `development` ou `production` | oui | défini par la commande de lancement et l'image |

Règles : `.env` est ignoré par Git ; sur le serveur il est en lecture seule pour son propriétaire (droits 600). L'application refuse de démarrer si une variable obligatoire manque ou a un format invalide (vérifié par un schéma Zod au démarrage).

## 3. Chaîne d'intégration continue (GitHub Actions)

1. **À chaque pull request** : installation, vérification que les fichiers générés depuis `tokens.json` sont à jour, lint (dont l'interdiction des valeurs de style en dur, ADR-0010), contrôle des types, tests unitaires, tests d'intégration sur une base PostgreSQL jetable, test des migrations (voir section 6), tests d'accessibilité (axe), audit des dépendances, scan de secrets.
2. **Merge sur `main`** : mêmes étapes, plus la construction de l'image Docker (non publiée).
3. **Tag `vX.Y.Z`** : mêmes étapes, puis publication de l'image sur GitHub Container Registry (`ghcr.io`, gratuit) sous le nom de version, jamais `latest`, et création des notes de version.

Une pull request ne peut être fusionnée que si toutes les étapes sont vertes. Les mises à jour de dépendances sont proposées automatiquement (Dependabot) et passent par la même chaîne.

## 4. Mise en production

Mise à jour manuelle, après validation humaine d'une version publiée (décision du 2026-10-26).

1. Sauvegarde automatique de la base, juste avant la mise à jour (section 5).
2. Sur le serveur : récupérer l'image de la nouvelle version (`docker compose pull` après avoir changé le numéro de version dans la configuration).
3. Appliquer les migrations de base (service `migrate` du `docker compose`, exécuté une fois).
4. Redémarrer l'application (`docker compose up -d`).
5. Vérifier `/health` et ouvrir une page de l'application.

La procédure complète, avec les commandes exactes, est écrite dans `README.md` à la création du squelette.

**Première mise en service d'une instance** : `docker compose up -d`, puis ouvrir l'adresse du club et remplir la page d'installation (club et premier administrateur) tout de suite après le déploiement (RG-17, ADR-0012).

**Commandes clés** (noms indicatifs)
- Installer : `pnpm install` ; lancer : `pnpm dev`
- Base locale : `docker compose up -d db`, puis `pnpm db:migrate` et `pnpm db:seed`
- Style : `pnpm tokens:build` (régénère les fichiers depuis `tokens.json`)
- Qualité : `pnpm lint`, `pnpm typecheck`, `pnpm test`

## 5. Reverse proxy, sauvegardes, supervision

**Reverse proxy : Caddy.** Il termine le HTTPS (certificats Let's Encrypt automatiques), redirige le HTTP vers le HTTPS et pose les en-têtes de `security.md` (HSTS, CSP, `nosniff`, `Referrer-Policy`, `frame-ancestors`). Les limites de débit par adresse IP sont appliquées par l'application, ce qui évite un module Caddy supplémentaire et suffit pour une seule instance. Caddy transmet l'adresse IP du client dans un en-tête lu quand `TRUST_PROXY` vaut `true`.

**Sauvegardes**
- Une sauvegarde par jour par `pg_dump`, chiffrée, conservée sur le serveur (décision du 2026-10-26) : 7 jours glissants, plus une par mois.
- Une sauvegarde supplémentaire est faite automatiquement avant chaque migration de production.
- Perte de données maximale 24 h, restauration en moins de 4 h (`architecture.md`).
- Restauration : arrêter l'application, déchiffrer la sauvegarde choisie, la recharger dans PostgreSQL, redémarrer, vérifier `/health`. Procédure à tester une fois avant la première mise en service, puis régulièrement.
- La clé de chiffrement est aussi gardée hors du serveur (`security.md`, section 2).

**Supervision**
- `/health` répond 200 si l'application et la base répondent. Un service externe gratuit l'interroge toutes les 5 minutes et envoie une alerte en cas d'arrêt.
- Journaux JSON sur la sortie standard, rotation Docker (par exemple 10 Mo sur 5 fichiers) ; format et contenu dans `security.md`.
- Espace disque surveillé (la base et les sauvegardes sont sur le même serveur).

**Maintenance** : versions d'images fixées (jamais `latest`, version majeure de PostgreSQL fixée), mises à jour du système du serveur chaque mois, correctifs de sécurité des dépendances par Dependabot.

## 6. Migrations et retour arrière

Décision du 2026-10-26 : les migrations de base sont des scripts SQL versionnés avec un script de retour écrit à la main.

- Chaque migration comprend un script d'application et un script de retour (par exemple `up.sql` et `down.sql`), relus ensemble dans la pull request.
- La commande de retour (`pnpm db:rollback`, nom indicatif) exécute le script de retour de la dernière migration. L'outil de migration exact (Prisma Migrate avec des fichiers SQL personnalisés, ou autre) est fixé au squelette ; Prisma Migrate seul ne sait pas revenir en arrière.
- L'intégration continue applique chaque migration, la défait, puis la rejoue sur une base jetable, pour vérifier que le retour fonctionne.
- Une migration qui détruit des données (suppression de colonne ou de table) est marquée irréversible : son retour est une restauration de la sauvegarde d'avant la mise à jour.
- En cas d'incident en production après une mise à jour : défaire la migration si elle est réversible, redéployer l'image de la version précédente, vérifier `/health` ; sinon restaurer la sauvegarde prise avant la mise à jour.

## 7. Points à confirmer

- Domaine du club et hébergeur du serveur (VPS ou Raspberry).
- Outil de chiffrement des sauvegardes (`age` proposé) et durée de conservation des sauvegardes mensuelles (12 mois proposés).
- Fréquence des tests de restauration (tous les 6 mois proposés).
- Outil exact de migration et de retour arrière, à fixer au squelette.
- Gestionnaire de paquets : pnpm (proposé dans `architecture.md`).
