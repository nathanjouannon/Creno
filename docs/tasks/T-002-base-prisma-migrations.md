# T-002 : Base PostgreSQL, schéma Prisma, migrations avec retour, jeu de données

Jalon : M0 – Squelette qui tourne de bout en bout  
Fonctionnalités : —  
Dépend de : T-001  
Taille : une session de travail

## Objectif
Rendre le schéma de `domain/schema.sql` exécutable avec Prisma, avec des migrations réversibles et un jeu de données de développement.

## À lire avant de commencer
- `domain/schema.sql`
- `domain/erd.mmd`
- `glossary.md` (sections 1 et 4)
- `adr/0002-postgresql-base-de-donnees.md`
- `adr/0003-identifiants-entiers.md`
- `adr/0005-nextjs-prisma-backend.md`
- `architecture/environments.md` (sections 1 et 6)

## Travail
- `docker-compose.yml` : service `db` PostgreSQL à version majeure fixée, volume, `docker compose up -d db`.
- `schema.prisma` fidèle à `schema.sql` : modèles aux noms du glossaire (`User`, `Club`, `Event`, `Slot`, `Registration`, `Invitation`, `ResetToken`, `LoginAttempt`), `@@map` vers les tables au pluriel, `@default(autoincrement())` pour les identifiants.
- Migration initiale en SQL : contraintes que Prisma ne porte pas (`CHECK`, index unique sur `lower(email)`, `club.id = 1`) ajoutées à la main.
- Chaque migration a un script d'application et un script de retour ; `pnpm db:migrate`, `pnpm db:rollback`, `pnpm db:seed`.
- Choisir l'outil de migration réversible (Prisma Migrate avec SQL personnalisé, ou autre) et l'écrire dans un ADR (`adr/0015-…`), comme demandé par l'ADR-0005.
- Jeu de données `seed` : un club, un administrateur, deux utilisateurs, trois événements (à venir, en cours, passé) avec des créneaux limités et illimités, quelques inscriptions.

## Critères d'acceptation
- Les noms de modèles et de champs sont ceux du glossaire ; aucun `Account`, `Shift`, `Member`.
- `pnpm db:migrate` sur une base vide crée exactement la structure de `schema.sql` ; `pnpm db:rollback` la défait.
- Insérer un créneau avec `capacity = 0`, une fin avant le début, ou deux utilisateurs dont les e-mails ne diffèrent que par la casse est refusé par la base.
- L'ADR de l'outil de migration est écrit et ajouté à la liste de `architecture/architecture.md`, section 7.

## Tests attendus
- Intégration (base jetable) : migrer, défaire, rejouer.
- Intégration : chaque contrainte `CHECK` et d'unicité refuse une ligne invalide.
- Le seed s'exécute deux fois sans erreur (idempotent ou documenté comme non rejouable).

## Hors périmètre
- Logique métier et dépôts (tickets suivants).

Terminé quand : `definition-of-done.md` est entièrement cochée.
