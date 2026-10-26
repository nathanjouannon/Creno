# ADR-0005 : Next.js + Prisma comme backend et accès aux données

Statut : acceptée (2026-10-26)

## Contexte
Il faut un backend TypeScript relationnel (ADR-0001, ADR-0002), avec des identifiants entiers (ADR-0003), une API REST décrite par OpenAPI (ADR-0011) et des transactions pour RG-04 et RG-07. Le volume est faible mais les fonctionnalités peuvent croître. La correspondance estimée aux besoins : Next.js + Prisma environ 85 %, Convex environ 50 %.

## Décision
Les routes et services côté serveur sont dans Next.js ; l'accès aux données passe par Prisma. Les migrations sont des scripts SQL versionnés, chacun avec un script de retour écrit à la main (`architecture/environments.md`, section 6) ; l'outil exact (Prisma Migrate avec fichiers SQL personnalisés, ou autre) est fixé au squelette. Le schéma `domain/schema.sql` reste la référence lisible ; `schema.prisma` en est la version exécutable (`@default(autoincrement())` pour les identifiants).

## Alternatives écartées
- Convex : base documentaire aux identifiants propres, incompatible avec le modèle relationnel et le choix `INT` ; auto-hébergement à vérifier. Son temps réel natif est le seul avantage, non requis au MVP (ADR-0008).
- Drizzle ou un client SQL direct : possibles, mais Prisma offre des migrations et des types générés adaptés à une équipe réduite.
- Next.js + FastAPI : voir ADR-0001.

## Conséquences
- (+) Types générés depuis le schéma, migrations versionnées, un seul langage.
- (-) Les contraintes que le schéma ne peut pas porter (RG-04 au moins un administrateur, RG-07 capacité non abaissée sous le nombre d'inscrits) restent dans les services, avec transactions.
- (-) Prisma ne gère pas toutes les contraintes SQL (index sur expression, CHECK) : elles sont ajoutées dans les migrations en SQL.
- (-) Prisma Migrate seul n'a pas de migration descendante : les scripts de retour sont à écrire et à tester à la main.
- La couche de services isolée de l'accès aux données limite le coût d'un changement ultérieur.
