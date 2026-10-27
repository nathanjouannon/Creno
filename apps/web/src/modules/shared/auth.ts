// The route envelope only needs "who is calling"; the real session (JWT cookie, role read from the
// database, tokenVersion check) is provided by the auth module in T-007 through `setAuthenticator`.
export type UserRole = 'USER' | 'ADMIN';

export interface SessionUser {
  id: number;
  role: UserRole;
}

/** Resolves the caller of a request, or null when there is no valid session. */
export type Authenticator = (request: Request) => Promise<SessionUser | null>;

const anonymous: Authenticator = async () => null;

let current: Authenticator = anonymous;

export const authenticate: Authenticator = (request) => current(request);

export function setAuthenticator(next: Authenticator): void {
  current = next;
}

export function resetAuthenticator(): void {
  current = anonymous;
}

/** Test double: always returns the given user (or nobody). */
export function fakeAuthenticator(user: SessionUser | null): Authenticator {
  return async () => user;
}
