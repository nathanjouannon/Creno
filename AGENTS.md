# AGENTS.md – Créno

Créno est une application web d'organisation de bénévoles pour les associations : un administrateur publie des événements avec des créneaux, les bénévoles s'y inscrivent, l'administrateur suit le remplissage. Elle remplace les formulaires et tableurs partagés.
Une instance = une association ; interface en français ; open source, budget 0 € ; mobile d'abord (360 px) ; moins de 200 comptes.
Stack : TypeScript, monorepo pnpm, Next.js (interface et routes REST), Prisma, PostgreSQL, Zod, Tailwind (depuis les tokens), Docker.
État du projet : la documentation (`docs/`) est complète jusqu'au plan de développement ; le code se construit tâche par tâche (`docs/roadmap.md`, tickets GitHub `T-001` à `T-023`). Tant qu'une commande ou un dossier ci-dessous n'existe pas, c'est la tâche T-001 à T-006 qui le crée.

## Avant d'écrire du code

1. Lis le ticket (issue GitHub `T-NNN`, numéro égal à celui de la tâche) et **seulement les fichiers qu'il cite**. Ne charge pas tout `docs/`.
2. Les documents sont la source de vérité, pas ta mémoire ni ta supposition. En cas de doute sur un comportement, la story (`docs/user-stories.md`) et la règle (`docs/domain/business-rules.md`) tranchent. Si elles se contredisent ou ne couvrent pas le cas, **pose la question** au lieu d'inventer.
3. Écris les tests du ticket avec le code, puis déroule `docs/definition-of-done.md`.

## Commandes

Noms indicatifs, fixés par T-001 à T-006 ; mets ce fichier à jour s'ils changent.

| But | Commande |
| --- | --- |
| Installer | `pnpm install` |
| Base locale | `docker compose up -d db`, puis `pnpm db:migrate` et `pnpm db:seed` ; retour arrière : `pnpm db:rollback` |
| Lancer | `pnpm dev` (http://localhost:3000) |
| Style depuis les tokens | `pnpm tokens:build` |
| Contrat d'API | `pnpm api:generate` (écrit `docs/api/`), `pnpm api:check` (échoue si périmé), `pnpm api:lint` (Redocly) |
| Qualité | `pnpm lint`, `pnpm typecheck` |
| Tests | `pnpm test` (`test:unit`, `test:integration`), `pnpm test:e2e` |
| Production | `docker compose up -d` ; procédure complète dans `README.md` |

## Règles « ne jamais faire »

**Architecture**
- Ne mets jamais une règle de gestion ou un contrôle de permission dans l'interface ou un dépôt : ils vivent dans les services. Sens des dépendances : interface → API → services → dépôts → base (`docs/conventions.md`, section 4).
- Ne fais jamais d'accès à la base hors d'un dépôt Prisma ; n'écris pas de SQL concaténé ni de SQL brut hors d'une migration revue.
- Ne stocke jamais un état calculé (`status`, `started`, `full`, `remainingPlaces`) ; n'appelle pas `new Date()` dans un service : utilise `clock.now()`.
- Ne remets pas en cause une décision d'un ADR (`docs/adr/`) ; si elle te bloque, propose un nouvel ADR.

**Données et API**
- Ne nomme jamais un concept autrement que dans `docs/glossary.md` (pas de `Account`, `Shift`, `Member`, `Booking`…).
- Ne modifie jamais à la main un fichier généré : `docs/api/openapi.yaml`, `docs/api/errors.json`, `docs/api/errors.md` (une fois générés), fichiers de tokens, client Prisma. Change la source et régénère.
- Ne change pas une route, un schéma ou un code d'erreur sans mettre à jour le schéma Zod, régénérer le contrat et le commiter ensemble.
- N'écris jamais un message d'erreur dans un schéma Zod ou un service : utilise un code du catalogue (`docs/api/errors.md`). L'interface se base sur `code`, jamais sur `message`.
- N'invente pas d'événement asynchrone, de file ou de webhook (`docs/api/events.md`).

**Sécurité**
- Aucun secret, aucune valeur de `.env` dans le dépôt, les journaux ou une réponse ; seul `.env.example` (sans valeurs) est versionné.
- Ne journalise jamais de mot de passe, de jeton ni d'e-mail en clair. Ne révèle jamais si une adresse a un compte (RG-03).
- Ne fais jamais confiance au client : toute entrée est validée par Zod, tout droit est vérifié côté serveur (RG-14). Rôle lu en base, pas dans le jeton.
- Pas de `dangerouslySetInnerHTML`, pas de jeton dans `localStorage`, pas de `latest` pour une image Docker.

**Interface**
- N'écris **jamais de couleur, de taille, d'espacement ni de rayon en dur** : uniquement les classes issues de `docs/design/tokens.json` (pas de `bg-[#2563EB]`, pas de `style={{…}}` d'apparence).
- N'ajoute pas de composant ou de variante qui n'est pas dans `docs/design/components.md` : décris-le d'abord.
- Ne fais pas reposer le sens sur la seule couleur ; chaque contrôle a un nom accessible.

**Méthode**
- N'ajoute pas de dépendance sans la justifier dans la pull request (ADR si elle structure l'application).
- Ne dépasse pas le périmètre du ticket ; ce qui est hors périmètre devient un ticket, pas un commentaire `TODO` sans numéro.
- Ne commite, ne pousse et n'ouvre de pull request que sur demande de l'utilisateur ; jamais de `--force`, jamais directement sur `main`.

## Conventions (résumé de `docs/conventions.md`)

- Code, commentaires, commits, branches, pull requests : **anglais**. `docs/`, issues, interface, messages affichés : **français**.
- Fichiers en `kebab-case`, composants en `PascalCase.tsx`, variables et champs JSON en `camelCase`, tables SQL en `snake_case` pluriel (Prisma : `@@map`, `@map`). Identifiants entiers.
- Commits : Conventional Commits (`feat(registrations): add last-seat locking`) ; branche `feat/T-014-registrations-api` ; un ticket = une branche = un ou plusieurs commits = une pull request, validée à la main avant fusion ; squash.
- Commentaires : ils disent pourquoi et citent la règle (`// RG-07: …`). Tests nommés avec leur scénario (`[F-07 S3] …`) ou leur règle (`RG-07: …`).
- Exemples de style à imiter : `docs/examples.md`.

## Index des documents : quand les lire

| Fichier | Contenu | À lire quand |
| --- | --- | --- |
| `docs/00-vision.md` | Problème, cible, limites | Un doute sur le but ou le périmètre |
| `docs/prd.md` | Fonctionnalités F-xx, priorités, MVP | Savoir si quelque chose est au MVP |
| `docs/user-stories.md` | Scénarios Given/When/Then par fonctionnalité | Tout ticket de comportement ; base des tests |
| `docs/glossary.md` | Un terme = une définition = un nom de code | Nommer quoi que ce soit |
| `docs/domain/business-rules.md` | Règles RG-xx | Tout service ; citer les règles |
| `docs/domain/schema.sql`, `erd.mmd` | Structure de la base | Schéma Prisma, migrations, dépôts |
| `docs/flows/*.mmd` | Parcours et états de chaque flux | Interface et enchaînement d'écrans |
| `docs/design/tokens.json`, `components.md`, `wireframes/`, `mockups/` | Style, composants, écrans (A1…E3) | Tout travail d'interface |
| `docs/architecture/architecture.md` | Exigences chiffrées, stack, modules, contraintes | Toute structure de code ; avant d'ajouter un module |
| `docs/architecture/c4-*.mmd` | Qui parle à qui | Placer une logique dans la bonne brique |
| `docs/architecture/security.md` | Menaces, secrets, rôles, règles de code, limites de débit | Authentification, permissions, entrées, journaux |
| `docs/architecture/environments.md` | Environnements, variables, CI/CD, sauvegardes, migrations | Configuration, déploiement, ajout de variable |
| `docs/adr/*.md` | Décisions et alternatives écartées | Avant de proposer un changement de technologie |
| `docs/api/openapi.yaml` | Contrat des routes (généré depuis Zod après T-005) | Toute route, tout appel d'API |
| `docs/api/errors.md` | Catalogue des erreurs et codes de champ | Toute erreur, tout message |
| `docs/api/events.md` | Aucun événement au MVP ; noms réservés | Si une notification ou une file est évoquée |
| `docs/roadmap.md`, issues GitHub | Jalons, tickets, dépendances | Choisir ou comprendre une tâche |
| `docs/testing.md` | Pyramide, seuils, tests obligatoires, matrice stories → tests | Écrire ou relire des tests |
| `docs/definition-of-done.md` | Liste de contrôle d'une tâche | Avant de déclarer une tâche terminée |
| `docs/conventions.md`, `docs/examples.md` | Nommage, structure, git, extraits de référence | Avant d'écrire du code |
| `docs/research/` | Entretiens, concurrents, spikes, décision GO | Comprendre le « pourquoi » d'un choix produit |

Un document par sujet : si une information manque ou se contredit entre deux fichiers, signale-le et corrige la source (en général la plus en amont : story, règle, ADR) dans le même commit.
