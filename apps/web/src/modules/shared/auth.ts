// The route envelope only needs "who is calling". By default the auth module answers (JWT cookie, user and role read
// from the database, tokenVersion check); tests replace it with `setAuthenticator`.
export type UserRole = 'USER' | 'ADMIN';

export interface SessionUser {
  id: number;
  role: UserRole;
}

/** Resolves the caller of a request, or null when there is no valid session. */
export type Authenticator = (request: Request) => Promise<SessionUser | null>;

// Loaded on first use: the auth module itself depends on `shared`.
const sessionAuthenticator: Authenticator = async (request) => {
  const { authenticateRequest } = await import('@/modules/auth');
  return authenticateRequest(request);
};

let current: Authenticator = sessionAuthenticator;

export const authenticate: Authenticator = (request) => current(request);

export function setAuthenticator(next: Authenticator): void {
  current = next;
}

export function resetAuthenticator(): void {
  current = sessionAuthenticator;
}

/** Test double: always returns the given user (or nobody). */
export function fakeAuthenticator(user: SessionUser | null): Authenticator {
  return async () => user;
}
