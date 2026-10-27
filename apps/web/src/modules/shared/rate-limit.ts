import { AppError } from '@creno/validation';
import { clock } from './clock';
import { getConfig } from './config';

// security.md, section 4: limits per IP address. The sensitive routes share one small budget.
const WINDOW_MS = 60_000;
const STRICT_LIMIT = 10;
const DEFAULT_LIMIT = 100;
const STRICT_PATHS = [
  /^\/api\/setup$/,
  /^\/api\/auth\/login$/,
  /^\/api\/password-resets(\/|$)/,
  /^\/api\/invitations(\/|$)/,
];
const MAX_TRACKED = 10_000;

interface Counter {
  windowStart: number;
  count: number;
}

// On globalThis so every bundle of the server shares one count (a single instance runs the club, architecture.md).
const store = globalThis as unknown as { __crenoRateLimits?: Map<string, Counter> };
const counters = () => (store.__crenoRateLimits ??= new Map());

/**
 * Address of the caller. Only Caddy's header is believed, and only when TRUST_PROXY is true: it overwrites whatever
 * the client sent, so its last entry is the real address. Otherwise every client falls in the same bucket.
 */
export function clientAddress(request: Request): string {
  if (!getConfig().TRUST_PROXY) return 'untrusted';
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return forwarded || 'unknown';
}

/** Throws RATE_LIMITED (with the seconds to wait) when the caller exhausted its budget for this minute. */
export function checkRateLimit(request: Request): void {
  const { pathname } = new URL(request.url);
  if (pathname === '/health') return; // public and unlimited (openapi.yaml)

  const strict = STRICT_PATHS.some((pattern) => pattern.test(pathname));
  const key = `${strict ? 'strict' : 'default'}:${clientAddress(request)}`;
  const now = clock.now().getTime();
  const all = counters();

  if (all.size > MAX_TRACKED) {
    for (const [k, c] of all) if (now - c.windowStart >= WINDOW_MS) all.delete(k);
  }

  let counter = all.get(key);
  if (!counter || now - counter.windowStart >= WINDOW_MS) {
    counter = { windowStart: now, count: 0 };
    all.set(key, counter);
  }
  counter.count += 1;

  if (counter.count > (strict ? STRICT_LIMIT : DEFAULT_LIMIT)) {
    throw new AppError('RATE_LIMITED', {
      retryAfter: Math.ceil((counter.windowStart + WINDOW_MS - now) / 1000),
    });
  }
}

export function resetRateLimits(): void {
  counters().clear();
}
