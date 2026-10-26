# ADR-0011 : API en routes REST décrites par OpenAPI

Statut : acceptée (2026-10-26)

## Contexte
Le workflow de conception prévoit un contrat d'interface écrit avant le code (`api/openapi.yaml`, phase 7), référence unique pour l'interface, les tests et l'IA. Les erreurs ont un format commun (`api/errors.md`). Il pourra y avoir un autre client que l'interface un jour.

## Décision
Routes REST sous `/api` (Route Handlers Next.js), décrites par `api/openapi.yaml`. Chaque route : authentification (ADR-0006), validation Zod (ADR-0009), appel d'un service, format d'erreur commun avec un `code` stable.

## Alternatives écartées
- Actions serveur Next.js : moins de code pour les formulaires, mais pas de contrat OpenAPI naturel ni de client tiers possible.
- tRPC : types partagés de bout en bout, mais pas de contrat HTTP standard.

## Conséquences
- (+) Contrat explicite et testable, utilisable par un futur client mobile ou un test automatisé.
- (-) Plus de code que les actions serveur ; synchronisation entre Zod et OpenAPI à garantir (voir ADR-0009).
