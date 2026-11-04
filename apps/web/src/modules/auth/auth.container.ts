import { clock, getConfig, getPrisma } from '@/modules/shared';
import { createAuthRepository } from './auth.repository';
import { createPasswordResetRepository } from './password-reset.repository';
import { createPasswordResetService, type PasswordResetService } from './password-reset.service';
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

let passwordReset: PasswordResetService | undefined;

export function getPasswordResetService(): PasswordResetService {
  if (!passwordReset) {
    const config = getConfig();
    passwordReset = createPasswordResetService({
      repository: createPasswordResetRepository(getPrisma()),
      clock,
      appUrl: config.APP_URL,
      secret: config.AUTH_SECRET,
      hashPassword,
    });
  }
  return passwordReset;
}

/**
 * The rescue command (`scripts/reset-link.ts`, RG-12, #82), run on the server outside the web application: it only
 * needs `APP_URL` to build the link. The sign-in secret only keys the block that `reset` lifts, never called here.
 */
export function getRescueLinkCreator(appUrl: string) {
  const service = createPasswordResetService({
    repository: createPasswordResetRepository(getPrisma()),
    clock,
    appUrl,
    secret: '',
    hashPassword,
  });
  return (email: string) => service.createRescueLink(email);
}

/** The authenticator the route envelope uses by default (shared/auth.ts). */
export const authenticateRequest = (request: Request) => getAuthService().resolveSession(request);
