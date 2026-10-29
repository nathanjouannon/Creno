# Contribuer à Créno

Merci de votre intérêt ! Créno est une application web d'organisation de bénévoles pour les associations. Une contribution peut être un rapport de bug, une idée, une correction de documentation ou du code. En participant, vous acceptez le [code de conduite](CODE_OF_CONDUCT.md).

## Signaler un bug ou proposer une idée

Ouvrez une [issue](../../issues/new/choose) avec le modèle adapté. Pour une faille de sécurité, suivez plutôt [`SECURITY.md`](SECURITY.md) : pas d'issue publique.

## Proposer du code

1. Parlez-en d'abord dans une issue.
2. Installez le projet : `pnpm install`, `docker compose up -d db`, `pnpm db:migrate`, `pnpm db:seed`, puis `pnpm dev` (voir `README.md`).
3. Créez une branche depuis `main` à jour, par exemple `feat/T-014-registrations-api`. Une branche = une pull request, sans jamais pousser sur `main`.
4. Écrivez les tests avec le code, puis vérifiez `pnpm lint`, `pnpm typecheck` et `pnpm test`.
5. Ouvrez la pull request en remplissant son modèle (liste de `docs/definition-of-done.md`). Elle est validée à la main puis fusionnée en squash.

## Règles à connaître

- **Langues** : code, commentaires, commits, branches et pull requests en anglais ; `docs/`, issues et interface en français.
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/) (`feat(registrations): add last-seat locking`).
- **Vocabulaire** : un terme = un nom de code, défini dans `docs/glossary.md`.
- **Architecture** : les règles de gestion et les permissions vivent dans les services, jamais dans l'interface ni dans un dépôt.
- **Interface** : uniquement les classes issues de `docs/design/tokens.json` ; pas de couleur ni de taille en dur.
- **Fichiers générés** (`docs/api/openapi.yaml`, client Prisma, tokens) : ne les modifiez pas à la main, changez la source et régénérez.
- **Dépendances** : toute nouvelle dépendance est justifiée dans la pull request.

Le détail est dans [`docs/conventions.md`](docs/conventions.md) et [`docs/definition-of-done.md`](docs/definition-of-done.md).
