import { errorCatalog } from '@creno/validation';

export interface ApiError {
  code: string;
  message: string;
  details?: { fields?: { field: string; code: string }[] };
  requestId?: string;
}

export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: ApiError };

/** JSON call to the API. The browser sends the `Origin` and the session cookie by itself. */
export async function postJson<T = unknown>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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
