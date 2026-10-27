import { clock, getConfig, getPrisma } from '@/modules/shared';
import { createAuthRepository } from './auth.repository';
import { createAuthService, type AuthService } from './auth.service';

let service: AuthService | undefined;

export function getAuthService(): AuthService {
  if (!service) {
    const config = getConfig();
    service = createAuthService({
      repository: createAuthRepository(getPrisma()),
      clock,
      secret: config.AUTH_SECRET,
      secureCookie: config.NODE_ENV === 'production',
    });
  }
  return service;
}

/** The authenticator the route envelope uses by default (shared/auth.ts). */
export const authenticateRequest = (request: Request) => getAuthService().resolveSession(request);
