# ADR-0009 : Zod pour la validation, schémas partagés

Statut : acceptée (2026-10-26)

## Contexte
Les formulaires (react-hook-form) et le serveur valident les mêmes données (RG-01, RG-06, RG-07). Écrire les règles deux fois ferait diverger l'interface et l'API. `architecture/security.md` exige la validation de toute entrée avant traitement.

## Décision
Zod. Un schéma par entrée (formulaire, requête d'API, paramètre de route), dans `packages/validation`, importé par l'interface (resolver de react-hook-form) et par le serveur. Les types se déduisent des schémas (`z.infer`). Les messages d'erreur viennent du catalogue `api/errors.md`, jamais écrits dans les schémas. Un schéma ne porte que les règles d'une donnée isolée ; les règles qui dépendent de la base (e-mail déjà utilisé, limite sous le nombre d'inscrits, dernier administrateur) restent dans les services.

## Alternatives écartées
- Valibot, ArkType : plus légers ou plus rapides, mais écosystème et resolver moins répandus.
- Yup : types moins précis.
- Validation écrite à la main : duplication et divergence.

## Conséquences
- (+) Une seule source de vérité, types garantis.
- (-) Les schémas Zod et le contrat OpenAPI (ADR-0011) doivent rester identiques ; la méthode (génération ou vérification en test) est à décider en phase 7.
