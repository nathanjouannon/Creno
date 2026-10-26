# Conventions – Créno

Statut : version 1.0 (2026-10-26). Découle de `glossary.md`, `architecture/architecture.md`, `architecture/security.md`, `api/openapi.yaml`, `design/components.md` et de l'historique git. Les chemins de dossiers sont ceux visés par T-001 ; en cas d'écart avec le code réel, le code et ce fichier sont corrigés ensemble. Extraits de code : `examples.md`.

## 1. Langues

| Élément | Langue |
| --- | --- |
| Identifiants (variables, fonctions, types, tables, champs JSON), commentaires de code, messages de commit, titres et descriptions de pull request, noms de branche | Anglais |
| `docs/`, issues GitHub, interface, messages d'erreur affichés, mentions légales | Français |

Les noms de code viennent de `glossary.md` (colonne « Code »). Un terme de la colonne « À ne pas employer » ne sert jamais de nom (`Account`, `Shift`, `Member`, `Signup`, `Booking`…). « inscription » = `Registration` ; créer un compte = créer un `User`.

## 2. Nommage

| Élément | Règle | Exemple |
| --- | --- | --- |
| Fichiers et dossiers | `kebab-case` ; composants React en `PascalCase.tsx` | `registration.service.ts`, `SlotCard.tsx` |
| Variables, fonctions, champs JSON | `camelCase` | `remainingPlaces`, `startsAt` |
| Types, classes, composants | `PascalCase` | `SlotInput`, `AppError` |
| Valeurs d'énumération | `MAJUSCULES` | `USER`, `ADMIN` |
| Constantes de configuration, variables d'environnement | `MAJUSCULES_AVEC_UNDERSCORES` | `AUTH_SECRET` |
| Tables SQL | `snake_case` au pluriel ; modèle Prisma au singulier avec `@@map` | table `registrations`, modèle `Registration` |
| Colonnes SQL | `snake_case` ; champ Prisma en `camelCase` avec `@map` | `starts_at` ↔ `startsAt` |
| Routes d'API | noms au pluriel, `kebab-case`, identifiants entiers | `/slots/{slotId}/registrations` |
| Codes d'erreur | `DOMAINE_CAUSE` ; codes de champ `FIELD_…` | `SLOT_FULL`, `FIELD_REQUIRED` |
| Fonctions booléennes et champs | préfixe `is`, `has`, `can` pour une fonction ; pour un champ du glossaire, son nom exact | `full`, `started`, `isMe` |
| Identifiants de règle et de fonctionnalité dans le code | `RG-07`, `F-07` dans les commentaires et les noms de tests | `// RG-07: capacity is never exceeded` |

États calculés (`status`, `started`, `full`, `remainingPlaces`, `empty`) : jamais stockés, toujours calculés dans les services à partir de l'horloge injectée.

## 3. Structure du dépôt

```
apps/web/
  src/
    app/                    pages, mises en page (français) et routes d'API (app/api/**/route.ts)
    components/             composants d'interface (design/components.md), un dossier par composant
    modules/
      <module>/             auth, club, members, invitations, events, slots, registrations, shared
        <module>.service.ts       règles de gestion, permissions, transactions
        <module>.repository.ts    seul accès à Prisma pour ce module
        index.ts                  API publique du module (seuls ces exports sont importables ailleurs)
        *.test.ts                 tests unitaires voisins
  tests/integration/  tests/e2e/  tests/factories/
  prisma/               schema.prisma, migrations/ (up.sql et down.sql)
packages/validation/    schémas Zod, catalogue d'erreurs, registre des routes
packages/tokens/        génération du style depuis design/tokens.json
docs/                   documentation (voir llms.txt)
```

## 4. Couches et dépendances

```
interface (app/, components/) → couche API (app/api/**/route.ts) → services → dépôts → PostgreSQL
```

- Le sens va toujours du haut vers le bas. L'interface n'importe ni service ni dépôt : elle appelle l'API.
- Une route d'API est mince : `route({ auth, params, body }, handler)` (authentification, validation Zod, erreurs), puis un appel de service, rien d'autre.
- Les règles de gestion (RG-xx), les permissions (RG-14) et les transactions vivent dans les services. Les dépôts ne contiennent que de l'accès aux données, sans règle.
- Un module n'utilise un autre module que par son `index.ts`.
- Prisma est importé uniquement par les dépôts ; pas de SQL brut hors migration revue (`security.md`).
- Toute dépendance nouvelle est justifiée dans la pull request (nom, usage, licence, alternative écartée) ; si elle structure l'application, un ADR est écrit.

## 5. Erreurs

- Un service signale un échec métier par `throw new AppError(code, details?)` avec un `code` du catalogue (`packages/validation`, `api/errors.md`). Il n'écrit jamais de message et n'invente jamais de code : un nouveau code s'ajoute d'abord au catalogue.
- L'enveloppe de route traduit en JSON `{ code, message, details?, requestId }`. Une exception inattendue devient `INTERNAL_ERROR` sans détail ; la trace va dans les journaux.
- L'interface se base sur `code`, jamais sur `message` ; elle affiche `message` à l'utilisateur.
- On ne masque pas une erreur (`catch {}` vide interdit) ; on la traite ou on la laisse remonter.
- Un événement ou un créneau passé répond « introuvable » à un utilisateur, `EVENT_PAST` à un administrateur (RG-09, RG-15).

## 6. Validation, dates, journaux

- Toute entrée externe passe par un schéma Zod de `packages/validation` avant tout traitement. Les schémas portent des **codes de champ** (`FIELD_*`), jamais de texte français (ADR-0009). Règles qui dépendent de la base : dans les services.
- Les types se déduisent des schémas (`z.infer`) ; pas de type écrit à la main en double, pas de `any` (`unknown` puis validation).
- Les dates sont des `Date` en UTC dans le code, des chaînes ISO 8601 UTC dans l'API, `timestamptz` en base. On les affiche dans le fuseau du club (`Club.timezone`, RG-16), jamais dans celui de l'appareil. Le code obtient l'heure par `clock.now()`, jamais par `new Date()` ou `Date.now()` dans un service.
- Journaux : JSON, un événement par ligne, avec `requestId` ; jamais de mot de passe, de jeton, ni d'e-mail en clair (`a***@d***.fr`).

## 7. Interface

- Composants de `design/components.md` uniquement ; un nouveau composant ou une nouvelle variante s'y décrit d'abord.
- **Aucune couleur, taille, espacement ni rayon en dur** : classes Tailwind issues de `tokens.json` (`bg-primary`, `text-text-muted`, `rounded-button`, `p-md`). Pas de valeur arbitraire (`bg-[#2563EB]`, `p-[13px]`) ni de `style={{ … }}` pour l'apparence ; le lint le refuse (ADR-0010).
- Un seul bouton `primary` par écran ; le sens ne repose jamais sur la seule couleur (texte présent).
- Accessibilité WCAG 2.2 AA (ADR-0007) : éléments HTML sémantiques, nom accessible pour chaque contrôle (un bouton « Je m'inscris » dit à quel créneau il se rapporte), focus visible, usage au clavier, erreurs annoncées.
- Chaque écran traite les états de chargement, vide et erreur, en mobile 360 px d'abord.
- Formulaires : `Form` + schéma Zod partagé avec le serveur ; les erreurs du serveur (`details.fields`) s'affichent sous leur champ avec le message du catalogue.
- `dangerouslySetInnerHTML` est interdit.
- Textes de l'interface : français, tutoiement, tels qu'écrits dans `user-stories.md` et `api/errors.md`.

## 8. Tests

- Un test par scénario et par règle, nommé avec son identifiant : `[F-07 S3] last seat taken at the same time`, `RG-07: capacity is never exceeded` (nom du test en anglais, identifiant en tête).
- Niveau le plus bas qui prouve la règle ; base PostgreSQL réelle en intégration ; horloge figée ; données par fabriques (`testing.md`).
- Un test d'accès refusé par route d'administration ; un test de concurrence pour RG-04 et RG-07.
- Pas de test qui dépend de la date du jour, de l'ordre d'exécution ou d'un autre test.

## 9. Git et pull requests

**Branches** : `type/T-NNN-short-slug` à partir de `main` (`feat/T-014-registrations-api`). `main` est protégée.

**Commits** : Conventional Commits en anglais, impératif, minuscule, sans point final, 72 caractères au plus pour la première ligne. Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`. Portée facultative : un module ou un domaine (`feat(registrations): …`, `docs(api): …`), comme dans l'historique (`docs(archi): …`). Un commit = un changement cohérent ; les fichiers générés (`openapi.yaml`, `errors.*`, tokens) sont commités avec le changement qui les provoque.

**Pull requests** : une tâche par pull request, jamais deux jalons.
- Titre : même format qu'un commit.
- Corps : *What* (le changement), *Why* (le ticket `Closes #n`, les règles RG-xx), *How tested* (tests automatisés, vérifications manuelles), *Docs* (ADR, contrat, glossaire mis à jour ou « aucun »), et la liste de `definition-of-done.md` cochée.
- Fusion en *squash* ; un titre de pull request qui suit Conventional Commits devient le message du commit.
- Aucune pull request avec la chaîne d'intégration continue rouge.

## 10. Documentation et décisions

- Un changement d'architecture met à jour son ADR et `architecture/architecture.md` dans le même commit ; une décision nouvelle a un ADR (`adr/00NN-….md` : contexte, décision, alternatives écartées, conséquences).
- Une règle de gestion qui change se corrige dans `domain/business-rules.md` sans renuméroter : une règle abandonnée est barrée.
- Les fichiers générés (`docs/api/openapi.yaml`, `docs/api/errors.*`, fichiers de tokens, client Prisma) ne se modifient jamais à la main.
- Commentaires de code : ils disent **pourquoi** (règle, contrainte, piège), pas ce que fait la ligne ; ils citent `RG-xx`. Pas de code commenté, pas de `TODO` sans numéro de ticket.
