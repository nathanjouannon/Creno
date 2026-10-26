# ADR-0001 : Monorepo TypeScript, monolithe modulaire, Next.js

Statut : acceptée (2026-10-26)

## Contexte
Application web développée bénévolement, budget 0 €, hébergement sur un petit serveur (PRD section 6). Volumétrie faible (200 comptes, 20 utilisateurs simultanés), mais le nombre de fonctionnalités peut croître (versions 1.1 et 2). Les schémas de validation et les types doivent rester identiques entre l'interface et le serveur.

## Décision
Un monorepo TypeScript avec une seule application déployable, Next.js (`apps/web`), découpée en modules métier (`auth`, `club`, `members`, `invitations`, `events`, `slots`, `registrations`, `shared`). Les couches vont toujours du haut vers le bas : interface, API, services, accès aux données. Les schémas Zod (`packages/validation`) et la génération du style (`packages/tokens`) sont des paquets partagés.

## Alternatives écartées
- Next.js + FastAPI (Python) : deux langages, types à synchroniser par OpenAPI, deux applications à déployer, sans gain à cette échelle.
- Microservices : complexité d'exploitation disproportionnée pour un club.
- Front et API Node séparés : deux déploiements sans besoin d'indépendance.

## Conséquences
- (+) Un seul langage, un seul déploiement, types partagés.
- (+) Les modules isolés permettent d'en extraire un plus tard si le besoin apparaît.
- (-) Le couplage doit être surveillé par les règles de dépendance (`architecture.md`, section 4), sinon le monolithe devient un seul bloc.
- L'IA place chaque règle de gestion dans un service, jamais dans l'interface ni dans l'accès aux données.
