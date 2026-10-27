import { errorCatalog, fieldErrorCatalog } from '../errors';
import { GENERATED_NOTICE } from './openapi';

export function buildErrorsJson(): string {
  return `${JSON.stringify({ _generated: GENERATED_NOTICE, errors: errorCatalog, fieldCodes: fieldErrorCatalog }, null, 2)}\n`;
}

export function buildErrorsMarkdown(): string {
  const codes = Object.entries(errorCatalog).map(
    ([code, e]) =>
      `| \`${code}\` | ${e.status} | ${e.message} | ${e.cause} |${e.details ? ` ${e.details} ` : ' '}| ${e.clientAction} |`,
  );
  const fields = Object.entries(fieldErrorCatalog).map(
    ([code, e]) => `| \`${code}\` | ${e.message} | ${e.cause} |`,
  );

  return `<!-- ${GENERATED_NOTICE} -->

# Catalogue des erreurs – Créno

Statut : version 0.1 (2026-10-26). Les messages reprennent ceux des scénarios de \`user-stories.md\`. Les schémas Zod n'écrivent jamais de message : ils renvoient un code de champ (section 3), traduit ici (ADR-0009).

Ce fichier et \`errors.json\` sont générés depuis le catalogue TypeScript de \`packages/validation\` (ADR-0014) ; \`pnpm api:check\` échoue s'ils diffèrent.

## 1. Format commun

Toute erreur de l'API renvoie ce JSON (schéma \`Error\` de \`openapi.yaml\`) :

\`\`\`json
{
  "code": "SLOT_FULL",
  "message": "Ce créneau vient d'être complété.",
  "details": { "slotId": 12 },
  "requestId": "req_8f3a21c4"
}
\`\`\`

- Le client se base sur \`code\` (stable), jamais sur \`message\` (peut changer).
- \`details\` est facultatif ; son contenu dépend du code (colonne « Détails »).
- \`requestId\` permet de retrouver l'erreur dans les journaux ; l'interface l'affiche pour \`INTERNAL_ERROR\`.
- Une réponse \`429\` ajoute l'en-tête \`Retry-After\` (secondes).

## 2. Codes

| Code | HTTP | Message affiché | Cause / règle | Détails | Action du client |
| --- | --- | --- | --- | --- | --- |
${codes.join('\n')}

## 3. Codes de champ (\`VALIDATION_ERROR\`, \`details.fields[].code\`)

Un code de champ ne se rattache pas à un statut HTTP : il explique pourquoi un champ est refusé. Les noms de champ sont ceux du corps de la requête, avec un point pour l'imbrication (\`admin.password\`, \`slots.0.endsAt\`).

| Code | Message affiché | Cause / règle |
| --- | --- | --- |
${fields.join('\n')}

## 4. Règles

- Un code ne change jamais de sens ; un code abandonné est marqué « obsolète », pas supprimé.
- Codes en \`MAJUSCULES_AVEC_UNDERSCORES\`, préfixés par le domaine (\`AUTH_\`, \`USER_\`, \`EVENT_\`, \`SLOT_\`, \`REGISTRATION_\`) ; les codes transverses n'ont pas de préfixe (\`VALIDATION_ERROR\`, \`FORBIDDEN\`, \`NOT_FOUND\`, \`RATE_LIMITED\`, \`INTERNAL_ERROR\`) ; les codes de champ commencent par \`FIELD_\`.
- Les messages ne révèlent rien de sensible : jamais « e-mail inconnu » et « mot de passe faux » séparément ; le blocage de connexion est identique que le compte existe ou non (RG-03, ADR-0013).
- Limite connue : \`USER_EMAIL_TAKEN\` révèle qu'une adresse a un compte, à qui détient un lien d'invitation valide ; risque accepté (\`architecture/security.md\`).
- Aucun détail technique (trace, SQL, nom de table) dans la réponse, seulement dans les journaux.
- Un événement ou un créneau passé répond « introuvable » à un utilisateur (RG-09) mais \`EVENT_PAST\` à un administrateur qui tente de le modifier (RG-15).
- Un message avec une valeur variable utilise un paramètre entre accolades, rempli depuis \`details\` (\`{registeredCount}\`).
`;
}
