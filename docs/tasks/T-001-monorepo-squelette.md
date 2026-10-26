# T-001 : Monorepo pnpm, Next.js, outils de qualité

Jalon : M0 – Squelette qui tourne de bout en bout  
Fonctionnalités : —  
Dépend de : aucune  
Taille : une session de travail

## Objectif
Créer le dépôt de code : espace de travail pnpm, application Next.js et outils de qualité, pour que `pnpm dev`, `pnpm lint`, `pnpm typecheck` et `pnpm test` fonctionnent.

## À lire avant de commencer
- `architecture/architecture.md` (sections 3, 4, 5)
- `adr/0001-monorepo-typescript-monolithe-modulaire.md`
- `architecture/environments.md` (sections 2 et 4)

## Travail
- Espace de travail pnpm : `apps/web` (Next.js, App Router, TypeScript strict), `packages/validation`, `packages/tokens`.
- Dossiers de modules métier dans `apps/web/src/modules/` : `auth`, `club`, `members`, `invitations`, `events`, `slots`, `registrations`, `shared` (noms de `architecture.md`, section 4), vides sauf un fichier d'index.
- Règle de dépendance contrôlée par le lint : interface → API → services → dépôts, jamais l'inverse ; l'interface n'importe jamais la couche d'accès aux données.
- ESLint, Prettier, `tsc --noEmit`, Vitest (projets « unit » et « integration »).
- Lecture de la configuration par un schéma Zod au démarrage (`environments.md`, section 2) ; `.env.example` sans valeurs ; `.gitignore` (`.env`).
- `README.md` : prérequis et commandes.

## Critères d'acceptation
- `pnpm install && pnpm dev` affiche une page d'accueil sur http://localhost:3000.
- `pnpm lint`, `pnpm typecheck` et `pnpm test` passent.
- L'application refuse de démarrer, avec un message qui nomme la variable, si une variable obligatoire manque ou est invalide.
- Un import qui viole la règle de dépendance fait échouer `pnpm lint`.

## Tests attendus
- Unitaire : schéma de configuration (variable manquante, format invalide).
- Un test volontairement en échec dans une branche jetable prouve que la règle de dépendance détecte une violation (non commité).

## Hors périmètre
- Docker, base de données, CI (tickets T-002 et T-006).
- Tout composant d'interface.

Terminé quand : `definition-of-done.md` est entièrement cochée.
