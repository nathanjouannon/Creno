# ADR-0002 : PostgreSQL comme base de données

Statut : acceptée (2026-10-26)

## Contexte
Les inscriptions exigent des transactions fiables (une place de créneau limité n'est jamais attribuée deux fois, RG-07) et des relations strictes entre tables (`domain/erd.mmd`). Le modèle est relationnel, les identifiants sont des entiers (ADR-0003). L'application doit être auto-hébergeable à très bas coût.

## Décision
PostgreSQL, en conteneur Docker aux côtés de l'application. Le schéma de référence est `domain/schema.sql`, repris dans `schema.prisma` (ADR-0005).

## Alternatives écartées
- SQLite : pas adapté à plusieurs instances de l'application ni aux sauvegardes à chaud simples.
- MySQL / MariaDB : possible, mais PostgreSQL offre de meilleures contraintes (index sur expression, contrainte CHECK, types) utilisées par le schéma.
- Base documentaire (MongoDB, Convex) : transactions et contraintes d'unicité à reconstruire dans le code, incompatibles avec le modèle relationnel retenu.

## Conséquences
- (+) Contraintes d'intégrité garanties par la base (unicité de l'e-mail sans tenir compte de la casse, une seule ligne `club`, une inscription par créneau et utilisateur).
- (+) Sauvegarde par `pg_dump`, effacement RGPD par `DELETE`.
- (-) Les migrations de schéma sont à gérer avec soin et à écrire réversibles.
- L'IA écrit du SQL ou du Prisma, pas de requêtes de type document.
