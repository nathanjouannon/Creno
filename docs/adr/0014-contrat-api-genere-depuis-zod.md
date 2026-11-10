# ADR-0014 : Contrat d'API écrit d'abord, puis généré depuis Zod

Statut : acceptée (2026-10-26) ; mise en œuvre au squelette par T-005 (2026-10-27, voir « Mise en œuvre »)

## Contexte
L'ADR-0009 (Zod) et l'ADR-0011 (OpenAPI) exigent que les schémas Zod et le contrat restent identiques, et renvoyaient la méthode à la phase 7. Le workflow est « documentation d'abord » : le contrat doit exister avant le code. Le porteur du projet préfère à terme un contrat généré depuis le code, et se demande s'il fait doublon avec Prisma.

Prisma décrit les tables (y compris `passwordHash`, `tokenVersion`, jetons hachés). Le contrat décrit ce que l'API expose : champs choisis, états calculés (`remainingPlaces`, `status`), noms affichés (« Prénom N. »), erreurs, authentification. Les deux ne se recouvrent pas ; générer l'un depuis l'autre exposerait des champs internes. La chaîne sans doublon est : `schema.prisma` pour la base, Zod pour les entrées et sorties de l'API, OpenAPI généré depuis Zod.

## Décision
1. **Phase 7 (maintenant, sans code)** : `api/openapi.yaml` et `api/errors.md` sont écrits à la main. Ils servent de spécification pour le squelette.
2. **Au squelette (phase 8)** : les routes sont déclarées avec leurs schémas Zod dans `packages/validation` (bibliothèque type `zod-openapi`, ou conversion JSON Schema native de Zod, à choisir à ce moment). `api/openapi.yaml` est alors généré, commité, et la CI échoue si le fichier commité diffère du fichier généré. Plus aucune modification à la main.
3. Le catalogue d'erreurs devient un fichier TypeScript, source de `api/errors.json` et de `api/errors.md` (générés, commités, même contrôle en CI). Les messages de champ des schémas Zod viennent de ce catalogue (ADR-0009).
4. Au passage en génération, le contrat écrit à la main sert de test : le fichier généré doit lui être équivalent, ou chaque écart est expliqué dans la pull request.

## Alternatives écartées
- Contrat écrit à la main pour toujours, avec un test de cohérence : duplication des règles et dérive possible.
- Décorateurs sur les handlers (style NestJS) : pas de standard avec les Route Handlers Next.js, beaucoup de code maison.
- Contrat non commité, servi par l'application : illisible par l'IA et les relecteurs sans lancer le projet.
- Générer le contrat depuis `schema.prisma` : expose la structure interne (voir Contexte).

## Conséquences
- (+) Une seule source de vérité après le squelette ; le contrat lisible reste dans le dépôt.
- (+) Le contrat existe avant le code, comme le prévoit le workflow.
- (-) Pendant la phase 7 à 8, le YAML est écrit à la main : une divergence avec les futurs schémas Zod est possible ; l'étape 4 la détecte.
- (-) Les règles qui dépendent de la base (e-mail déjà utilisé, dernier administrateur…) ne sont pas dans Zod : elles sont décrites dans les réponses d'erreur du contrat par les déclarations de route, pas par les schémas.
- `api/events.md` dit qu'il n'y a aucun événement asynchrone au MVP (ADR-0008) et réserve les noms futurs. `api/errors.json` n'est pas créé avant le squelette : seul `errors.md` fait foi jusque-là.

## Mise en œuvre (T-005, 2026-10-27)
- **Bibliothèque** : `@asteasolutions/zod-to-openapi`, avec OpenAPI 3.1 : 7.x sur Zod 3 à l'origine, 8.x depuis le passage à Zod 4 (#83, avis de sécurité GHSA-mrhx-c7xc-m3w5 corrigé à partir de Zod 4.6.6). Zod 4 sait convertir un schéma en JSON Schema, mais cette bibliothèque gère aussi les chemins, les réponses et les composants, ce qu'une simple conversion de schéma ne fait pas ; elle reste donc le générateur. Les schémas se nomment sur place avec `.openapi('Nom')` (extension chargée par `packages/validation`, poids négligeable).
- **Registre des routes** : `packages/validation/src/contract/routes.ts` (chemin, méthode, rôle requis `public`/`user`/`admin`, schémas, réponses d'erreur avec leurs codes). Il est exporté dans le contrat par les extensions `x-auth` et `x-error-codes`.
- **Commandes** : `pnpm api:generate` écrit `docs/api/openapi.yaml`, `errors.json` et `errors.md` ; `pnpm api:check` échoue si l'un d'eux diffère ; `pnpm api:lint` passe le fichier au lint Redocly (`redocly.yaml`).
- **Entrées strictes** : les schémas d'entrée refusent les champs inconnus (`FIELD_UNKNOWN`), ce que le contrat exprime par `additionalProperties: false`.
- Les règles qui dépendent de la base restent décrites par les réponses d'erreur des routes, pas par les schémas.

