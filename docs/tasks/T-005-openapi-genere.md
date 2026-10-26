# T-005 : Schémas Zod du contrat et génération d'OpenAPI et du catalogue

Jalon : M0 – Squelette qui tourne de bout en bout  
Fonctionnalités : —  
Dépend de : T-004  
Taille : une session de travail

## Objectif
Passer de « contrat écrit à la main » à « contrat généré depuis Zod » (ADR-0014, étapes 2 à 4), pour les 24 opérations du contrat.

## À lire avant de commencer
- `api/openapi.yaml`
- `api/errors.md`
- `adr/0014-contrat-api-genere-depuis-zod.md`
- `adr/0009-zod-validation-partagee.md`
- `adr/0011-api-rest-openapi.md`

## Travail
- Choisir la bibliothèque de génération (`zod-openapi` ou conversion JSON Schema native de Zod) et mettre à jour l'ADR-0014.
- Écrire dans `packages/validation` tous les schémas d'entrée et de sortie du contrat (`User`, `EventInput`, `SlotInput`, `Slot`, etc.) et le registre des routes (chemin, méthode, rôle requis, schémas, codes d'erreur).
- `pnpm api:generate` produit `docs/api/openapi.yaml`, `docs/api/errors.json` et `docs/api/errors.md` ; `pnpm api:check` échoue si les fichiers commités diffèrent des fichiers générés.
- Comparer le fichier généré au contrat écrit à la main ; chaque écart est soit corrigé, soit expliqué dans la pull request et le contrat adapté.
- Le champ « message » de `errors.md` et les codes de champ restent identiques à ceux d'avant.

## Critères d'acceptation
- Le fichier généré est valide OpenAPI 3.1 (lint Redocly sans erreur).
- Les 24 opérations, leurs schémas, leurs codes d'erreur et leurs rôles sont présents ; les écarts avec le contrat manuel sont listés dans la pull request.
- Modifier un schéma Zod sans régénérer fait échouer `pnpm api:check`.
- `docs/api/errors.json` existe et contient tous les codes d'`errors.md`.
- Les fichiers générés portent un en-tête « ne pas modifier à la main ».

## Tests attendus
- Unitaire : un schéma Zod d'exemple produit le JSON Schema attendu.
- Intégration : `api:check` en succès puis en échec après modification.

## Hors périmètre
- Implémentation des handlers (tickets suivants) : seuls les schémas et le registre sont écrits ici.

Terminé quand : `definition-of-done.md` est entièrement cochée.
