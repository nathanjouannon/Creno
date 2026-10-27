import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { ResponseConfig, RouteConfig } from '@asteasolutions/zod-to-openapi';
import { Document } from 'yaml';
import {
  acceptInvitationInputSchema,
  attendeeSchema,
  clubSchema,
  emailSchema,
  errorSchema,
  eventDetailSchema,
  eventInputSchema,
  eventStatusSchema,
  eventSummarySchema,
  eventUpdateSchema,
  fieldErrorSchema,
  loginInputSchema,
  passwordSchema,
  roleSchema,
  setupInputSchema,
  shareableLinkSchema,
  slotInputSchema,
  slotSchema,
  slotUpdateSchema,
  userSchema,
} from '../schemas';
import { routes, sharedResponses, type ErrorResponse, type RouteDefinition } from './routes';

export const GENERATED_NOTICE =
  'Fichier généré par `pnpm api:generate` depuis packages/validation (ADR-0014). Ne pas modifier à la main : changer le schéma Zod ou le registre des routes, puis régénérer.';

const DESCRIPTION = `Contrat de l'API REST de Créno pour le MVP (F-01 à F-11, F-19). Référence unique pour l'interface, les tests et l'IA.

Statut : généré depuis les schémas Zod et le registre des routes de \`packages/validation\` (ADR-0014), commité ici ; \`pnpm api:check\` échoue si le fichier commité diffère du fichier généré.

Conventions
- Noms des champs en camelCase, noms de domaine du \`glossary.md\`. Identifiants entiers (ADR-0003).
- Dates et heures en ISO 8601 UTC (\`2027-01-15T07:00:00Z\`) ; l'interface les affiche dans le fuseau du club (RG-16).
- Une réponse d'erreur suit toujours le schéma \`Error\` ; le client se base sur \`code\`, jamais sur \`message\` (\`errors.md\`).
- Corps de requête et de réponse en \`application/json\`, sauf les réponses \`204\` qui n'ont pas de corps.
- Pas de pagination au MVP : un club compte quelques dizaines de membres et d'événements.
- Les états calculés (\`status\`, \`started\`, \`full\`, \`remainingPlaces\`) sont fournis par le serveur, jamais stockés (glossaire).
- Le serveur ne renvoie pas d'avertissement de créneau hors des dates de l'événement (RG-07) : c'est l'interface qui l'affiche, la création n'est jamais refusée pour ce motif.
- Une requête qui modifie des données est refusée (\`403 FORBIDDEN_ORIGIN\`) si son en-tête \`Origin\` n'est pas celui de l'application (\`security.md\`).
- Limites de débit par adresse IP : 10 requêtes par minute sur \`/setup\`, \`/auth/login\`, \`/password-resets/*\` et \`/invitations/*\` ; 100 par minute sur le reste (\`429 RATE_LIMITED\` avec \`Retry-After\`).
- Aucun événement asynchrone ni file de messages au MVP (ADR-0008), voir \`events.md\`.
- Extensions : \`x-auth\` (\`public\`, \`user\` ou \`admin\`) donne le rôle requis par l'opération (RG-14) ; \`x-error-codes\` liste les codes de \`errors.md\` que la réponse peut porter.
`;

// Order of the tags and of the named schemas in the document.
const TAGS = [
  'Installation',
  'Authentification',
  'Invitations',
  'Événements',
  'Créneaux',
  'Inscriptions',
  'Membres',
  'Supervision',
];
const NAMED_SCHEMAS = [
  errorSchema,
  fieldErrorSchema,
  roleSchema,
  passwordSchema,
  emailSchema,
  userSchema,
  clubSchema,
  setupInputSchema,
  loginInputSchema,
  acceptInvitationInputSchema,
  shareableLinkSchema,
  eventStatusSchema,
  eventSummarySchema,
  eventDetailSchema,
  eventInputSchema,
  eventUpdateSchema,
  slotInputSchema,
  slotUpdateSchema,
  slotSchema,
  attendeeSchema,
];

const errorBody = { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } };
const sessionCookie = { 'Set-Cookie': { $ref: '#/components/headers/SessionCookie' } };

function errorResponse(error: ErrorResponse): ResponseConfig & { 'x-error-codes': string[] } {
  return { description: error.description, content: errorBody, 'x-error-codes': error.codes };
}

function responsesOf(route: RouteDefinition): RouteConfig['responses'] {
  const { success } = route;
  const responses: RouteConfig['responses'] = {
    [success.status]: {
      description: success.description,
      ...(success.setsCookie ? { headers: sessionCookie } : {}),
      ...(success.schema ? { content: { 'application/json': { schema: success.schema } } } : {}),
    },
  };
  for (const error of route.errors) {
    const status = typeof error === 'string' ? sharedResponses[error].status : error.status;
    if (responses[status])
      throw new Error(`${route.operationId}: two responses for HTTP ${status}`);
    responses[status] =
      typeof error === 'string'
        ? { $ref: `#/components/responses/${error}` }
        : errorResponse(error);
  }
  return responses;
}

function pathOf(route: RouteDefinition): RouteConfig {
  return {
    method: route.method,
    path: route.path,
    tags: [route.tag],
    operationId: route.operationId,
    summary: route.summary,
    ...(route.description ? { description: route.description } : {}),
    // Public routes opt out of the document-wide cookie authentication
    ...(route.auth === 'public' ? { security: [] } : {}),
    ...(route.atRoot ? { servers: [{ url: '/', description: 'À la racine, hors `/api`' }] } : {}),
    'x-auth': route.auth,
    request: {
      ...(route.params ? { params: route.params as never } : {}),
      ...(route.query ? { query: route.query as never } : {}),
      ...(route.body
        ? { body: { required: true, content: { 'application/json': { schema: route.body } } } }
        : {}),
    },
    responses: responsesOf(route),
  } as RouteConfig;
}

export function buildOpenApiDocument(): object {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: '__Host-session',
    description:
      'JWT dans un cookie `HttpOnly`, `Secure`, `SameSite=Lax`, chemin `/`, valable 30 jours (ADR-0006).\nVérifié en base à chaque requête (utilisateur existant, `tokenVersion` identique). Absent ou refusé : `401 AUTH_REQUIRED`.\n',
  });
  registry.registerComponent('headers', 'SessionCookie', {
    description: 'Pose (ou efface) le cookie de session `__Host-session`',
    schema: { type: 'string' },
  });
  for (const [name, response] of Object.entries(sharedResponses)) {
    registry.registerComponent('responses', name, {
      description: response.description,
      ...(name === 'RateLimited'
        ? {
            headers: {
              'Retry-After': { description: 'Secondes à attendre', schema: { type: 'integer' } },
            },
          }
        : {}),
      content: errorBody,
      'x-error-codes': [...response.codes],
    } as never);
  }
  for (const route of routes) registry.registerPath(pathOf(route));

  const document = new OpenApiGeneratorV31([
    ...registry.definitions,
    ...NAMED_SCHEMAS,
  ]).generateDocument({
    openapi: '3.1.0',
    info: { title: 'API Créno', version: '0.1.0', description: DESCRIPTION },
    servers: [{ url: '/api', description: "Même origine que l'application" }],
    tags: TAGS.map((name) => ({ name })),
    security: [{ cookieAuth: [] }],
  });
  return document;
}

export function buildOpenApiYaml(): string {
  const doc = new Document(buildOpenApiDocument());
  doc.commentBefore = ` ${GENERATED_NOTICE}`;
  return doc.toString({ lineWidth: 0 });
}
