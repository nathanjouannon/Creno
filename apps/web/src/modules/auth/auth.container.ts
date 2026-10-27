import { clock, getConfig, getPrisma } from '@/modules/shared';
import { createAuthRepository } from './auth.repository';
import { createLoginRepository } from './login.repository';
import { createLoginService, type LoginService } from './login.service';
import { hashPassword, verifyPassword } from './password';
import { createAuthService, toUserView, type AuthService } from './auth.service';

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

let login: LoginService | undefined;

export function getLoginService(): LoginService {
  if (!login) {
    login = createLoginService({
      repository: createLoginRepository(getPrisma()),
      clock,
      secret: getConfig().AUTH_SECRET,
      hashPassword,
      verifyPassword,
      openSession: (user) => getAuthService().openSession(user),
      toUserView,
    });
  }
  return login;
}

/** The authenticator the route envelope uses by default (shared/auth.ts). */
export const authenticateRequest = (request: Request) => getAuthService().resolveSession(request);
