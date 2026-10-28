import { errorCatalog } from '@creno/validation';

export interface ApiError {
  code: string;
  message: string;
  details?: { fields?: { field: string; code: string }[]; registeredCount?: number };
  requestId?: string;
}

export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: ApiError };

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** JSON call to the API. The browser sends the `Origin` and the session cookie by itself. */
async function request<T>(method: Method, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    if (response.ok) {
      const text = await response.text();
      return { ok: true, data: (text ? JSON.parse(text) : undefined) as T };
    }
    return { ok: false, error: (await response.json()) as ApiError };
  } catch {
    // Network failure or unreadable answer: same wording as a server error, from the catalog
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: errorCatalog.INTERNAL_ERROR.message },
    };
  }
}

export const getJson = <T = unknown>(path: string) => request<T>('GET', path);
export const postJson = <T = unknown>(path: string, body: unknown) =>
  request<T>('POST', path, body);
export const patchJson = <T = unknown>(path: string, body: unknown) =>
  request<T>('PATCH', path, body);
export const deleteJson = (path: string) => request<undefined>('DELETE', path);
