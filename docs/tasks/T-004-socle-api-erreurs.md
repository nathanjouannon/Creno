# T-004 : Socle API : erreurs, validation, journaux, santé

Jalon : M0 – Squelette qui tourne de bout en bout  
Fonctionnalités : —  
Dépend de : T-001, T-002  
Taille : une session de travail

## Objectif
Fournir ce que toutes les routes partagent : catalogue d'erreurs, enveloppe de route, journaux, horloge et `/health`.

## À lire avant de commencer
- `api/errors.md`
- `api/openapi.yaml` (schéma `Error`, `/health`)
- `architecture/security.md` (section 4, Journaux)
- `adr/0009-zod-validation-partagee.md`
- `adr/0011-api-rest-openapi.md`
- `architecture/architecture.md` (sections 4 et 5)

## Travail
- Catalogue d'erreurs en TypeScript dans `packages/validation` : un objet par code (HTTP, message, règle, détails, action client), contenu issu de `api/errors.md`, sections 2 et 3.
- Classe d'erreur applicative portant un `code` du catalogue et des `details`.
- Enveloppe de Route Handler : identifiant `requestId`, authentification facultative, requise ou administrateur (l'authentification réelle vient de T-007 : interface et doublure de test), validation Zod du corps et des paramètres, traduction des erreurs en `Error` (erreurs Zod → `VALIDATION_ERROR` avec `details.fields` aux codes `FIELD_*`, erreur inattendue → `INTERNAL_ERROR` sans détail technique).
- Journaux JSON sur la sortie standard avec `requestId`, sans mot de passe, jeton ni e-mail complet (e-mail masqué).
- Module `shared` : horloge injectable (`now()`) et conversion de fuseau (RG-16).
- `GET /health` à la racine : 200 `{ status: "ok" }` si la base répond, 503 `SERVICE_UNAVAILABLE` sinon.

## Critères d'acceptation
- Toute erreur renvoyée a exactement la forme du schéma `Error` de `openapi.yaml`.
- Un corps invalide renvoie `400 VALIDATION_ERROR` avec le champ et un code `FIELD_*` ; aucun message n'est écrit dans un schéma Zod.
- Une exception inattendue renvoie `500 INTERNAL_ERROR` ; la trace est dans les journaux, pas dans la réponse.
- `/health` répond 503 quand la base est arrêtée.
- Aucun journal ne contient d'e-mail complet ni de mot de passe.

## Tests attendus
- Unitaire : traduction de chaque type d'erreur ; masquage des journaux.
- Intégration : `/health` avec base démarrée et arrêtée ; réponse d'erreur conforme au schéma OpenAPI.

## Hors périmètre
- Authentification réelle (T-007).

Terminé quand : `definition-of-done.md` est entièrement cochée.
