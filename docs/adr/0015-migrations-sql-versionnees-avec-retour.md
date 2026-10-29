# ADR-0015 : Migrations SQL versionnées avec script de retour, exécutées par Prisma Migrate

Statut : acceptée (2026-10-26)

## Contexte
L'ADR-0005 et `architecture/environments.md` (section 6) exigent des migrations réversibles et laissent l'outil au squelette. Prisma Migrate sait appliquer des fichiers SQL versionnés (y compris écrits à la main : `CHECK`, index sur `lower(email)`) mais n'a pas de migration descendante.

## Décision
- Chaque migration est un dossier `apps/web/prisma/migrations/<horodatage>_<nom>/` avec `migration.sql` (application, lu par Prisma Migrate) et `down.sql` (retour, écrit à la main).
- `pnpm db:migrate` exécute `prisma migrate deploy` puis `prisma generate` (le client ne reste pas périmé après un `git pull`) ; `pnpm db:deploy` n'exécute que les migrations (image de production, client généré au build). `pnpm db:rollback` (`apps/web/prisma/tools.ts`) lit la dernière migration appliquée dans `_prisma_migrations`, exécute son `down.sql` et supprime sa ligne, dans une seule transaction.
- `schema.prisma` décrit les modèles pour le client typé ; les contraintes qu'il ne porte pas ne sont que dans `migration.sql`. Le client Prisma n'est jamais utilisé pour générer une migration (`migrate dev` n'est pas utilisé) : le SQL est écrit à la main et relu avec son `down.sql`.
- Le test d'intégration `migrations.test.ts` crée une base jetable, applique, défait, rejoue, puis vérifie les contraintes ; la CI l'exécute sur chaque pull request.
- Une migration destructrice est marquée irréversible dans son `down.sql` ; son retour est la restauration de la sauvegarde (`environments.md`, section 6).

## Alternatives écartées
- Un outil dédié (dbmate, Flyway, Atlas) : retours natifs, mais un second outil et un second binaire à côté de Prisma, sans gain à cette échelle.
- Prisma Migrate seul : pas de retour arrière (ADR-0005).
- Dériver les migrations de `schema.prisma` (`migrate dev`) : perd les `CHECK` et l'index sur expression.

## Conséquences
- (+) Un seul outil d'application, retour testé en continu, SQL relu tel qu'il s'exécute.
- (-) Le script de retour et la correspondance `schema.prisma` / SQL sont maintenus à la main ; le test de contraintes détecte les écarts les plus graves.
