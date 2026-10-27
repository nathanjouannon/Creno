import { AppError } from '@creno/validation';
import { getConfig } from './config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection next to SameSite=Lax (ADR-0006, security.md): a request that changes data must come from the
 * application itself. A missing `Origin` is refused too, since browsers always send it on such requests.
 */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;
  const expected = new URL(getConfig().APP_URL).origin;
  if (request.headers.get('origin') !== expected) throw new AppError('FORBIDDEN_ORIGIN');
}
