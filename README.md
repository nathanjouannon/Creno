# Créno

Application web d'organisation de bénévoles pour les associations : l'administrateur publie des événements avec des créneaux, les bénévoles s'y inscrivent.

## Prérequis

- Node.js 20.19 ou plus
- pnpm 10 (`corepack enable`)
- Docker (base PostgreSQL locale, à partir de T-002)

## Commandes

| But | Commande |
| --- | --- |
| Installer | `pnpm install` |
| Configurer | copier `.env.example` en `.env` et remplir les valeurs |
| Lancer | `pnpm dev` (http://localhost:3000) |
| Qualité | `pnpm lint`, `pnpm typecheck` |
| Tests | `pnpm test` (`test:unit`, `test:integration`) |

L'application refuse de démarrer si une variable d'environnement obligatoire manque ou est invalide (`docs/architecture/environments.md`).

La documentation complète est dans `docs/` ; le plan de développement dans `docs/roadmap.md`.
