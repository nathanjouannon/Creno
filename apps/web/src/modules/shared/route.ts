import { randomBytes } from 'node:crypto';
import {
  AppError,
  errorCatalog,
  formatErrorMessage,
  type ErrorCode,
  type ErrorDetails,
} from '@creno/validation';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { authenticate, type SessionUser } from './auth';
import { clock } from './clock';
import { toFieldErrors } from './field-errors';
import { assertSameOrigin } from './origin';
import { checkRateLimit } from './rate-limit';
import { getLogger, type Logger } from './logger';

/** `optional`: user if signed in, otherwise null. `user`: signed in. `admin`: signed in with the ADMIN role (RG-14). */
export type RouteAuth = 'optional' | 'user' | 'admin';

type Infer<S> = S extends ZodTypeAny ? z.infer<S> : undefined;

interface RouteConfig<A extends RouteAuth, B, P, Q> {
  auth: A;
  body?: B;
  params?: P;
  query?: Q;
}

export interface RouteContext<A extends RouteAuth, B, P, Q> {
  request: Request;
  requestId: string;
  user: A extends 'optional' ? SessionUser | null : SessionUser;
  body: Infer<B>;
  params: Infer<P>;
  query: Infer<Q>;
  log: Logger;
}

export interface RouteResult {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: ErrorDetails;
  requestId: string;
}

type NextRouteContext = { params: Promise<Record<string, string | string[]>> };

/** Next.js requires the second argument on its type check; calling without it (static routes, tests) is allowed. */
export interface RouteHandler {
  (request: Request): Promise<Response>;
  (request: Request, context: NextRouteContext): Promise<Response>;
}

export function newRequestId(): string {
  return `req_${randomBytes(4).toString('hex')}`;
}

/** Translates anything thrown by a route into the `Error` schema of openapi.yaml (errors.md, section 1). */
export function toErrorResponse(error: unknown, requestId: string, log: Logger): Response {
  let code: ErrorCode;
  let details: ErrorDetails | undefined;
  const headers: Record<string, string> = { 'X-Request-Id': requestId };

  if (error instanceof AppError) {
    code = error.code;
    details = error.details;
    const { retryAfter, ...rest } = error.details ?? {};
    if (code === 'RATE_LIMITED' && typeof retryAfter === 'number') {
      headers['Retry-After'] = String(retryAfter);
      details = Object.keys(rest).length > 0 ? rest : undefined; // errors.md: RATE_LIMITED has no details
    }
  } else if (error instanceof ZodError) {
    code = 'VALIDATION_ERROR';
    details = { fields: toFieldErrors(error) };
  } else {
    // The trace stays in the logs; the response carries no technical detail (security.md, section 4).
    code = 'INTERNAL_ERROR';
    log.error('unexpected error', { err: error });
  }

  const { status } = errorCatalog[code];
  const body: ErrorBody = { code, message: formatErrorMessage(code, details), requestId };
  if (details && code !== 'INTERNAL_ERROR') body.details = details;
  return Response.json(body, { status, headers });
}

/**
 * security.md, section 4: the largest body the API reads, enough for an event with a hundred slots and their
 * descriptions. Next.js puts no limit on Route Handlers, so without it one anonymous request could fill the memory.
 */
export const MAX_BODY_BYTES = 128 * 1024;

/** The body as text, read chunk by chunk and given up as soon as it exceeds the limit, whatever Content-Length says. */
async function readLimitedText(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES)
    throw new AppError('PAYLOAD_TOO_LARGE');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new AppError('PAYLOAD_TOO_LARGE');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function readBody(request: Request): Promise<unknown> {
  const text = await readLimitedText(request);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {}; // Empty or malformed JSON is reported by the schema as missing fields
  }
}

function readQuery(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

function parse<S extends ZodTypeAny | undefined>(schema: S, value: unknown): Infer<S> {
  if (!schema) return undefined as Infer<S>;
  const result = schema.safeParse(value);
  if (!result.success) throw result.error;
  return result.data;
}

/**
 * Route Handler envelope (api layer): request id, authentication, Zod validation of body, params and query,
 * error translation and one log line per request. Business rules stay in services.
 */
export function route<
  A extends RouteAuth,
  B extends ZodTypeAny | undefined = undefined,
  P extends ZodTypeAny | undefined = undefined,
  Q extends ZodTypeAny | undefined = undefined,
>(
  config: RouteConfig<A, B, P, Q>,
  handler: (context: RouteContext<A, B, P, Q>) => Promise<RouteResult> | RouteResult,
) {
  const handle = async (request: Request, nextContext?: NextRouteContext): Promise<Response> => {
    const requestId = newRequestId();
    const startedAt = clock.now().getTime();
    let log = getLogger().child({ requestId, method: request.method });
    let response: Response;
    let code: ErrorCode | undefined;

    try {
      // Cheapest refusals first: request budget, then origin, then who is calling
      checkRateLimit(request);
      assertSameOrigin(request);
      const user = await authenticate(request);
      if (config.auth !== 'optional' && !user) throw new AppError('AUTH_REQUIRED');
      // RG-14: the role comes from the authenticator (database), never from the client
      if (config.auth === 'admin' && user?.role !== 'ADMIN') throw new AppError('FORBIDDEN');
      if (user) log = log.child({ userId: user.id });

      const rawParams = nextContext?.params ? await nextContext.params : {};
      const params = parse(config.params, rawParams);
      const query = parse(config.query, readQuery(request));
      const body = parse(config.body, config.body ? await readBody(request) : undefined);

      const result = await handler({
        request,
        requestId,
        user: user as RouteContext<A, B, P, Q>['user'],
        body: body as Infer<B>,
        params: params as Infer<P>,
        query: query as Infer<Q>,
        log,
      });
      const status = result.status ?? 200;
      const headers = { 'X-Request-Id': requestId, ...result.headers };
      response =
        result.body === undefined || status === 204
          ? new Response(null, { status, headers })
          : Response.json(result.body, { status, headers });
    } catch (error) {
      response = toErrorResponse(error, requestId, log);
      code =
        error instanceof AppError
          ? error.code
          : error instanceof ZodError
            ? 'VALIDATION_ERROR'
            : 'INTERNAL_ERROR';
    }

    log.info('request', {
      status: response.status,
      code,
      durationMs: clock.now().getTime() - startedAt,
    });
    return response;
  };
  return handle as RouteHandler;
}
