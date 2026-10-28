'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, type ApiError } from './api-client';

export type ApiState<T> =
  { status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'ready'; data: T };

/**
 * Reads a resource of the API for a page, with its loading and error states. `reload` reads it again after an
 * action: the screen is updated after each answer, without real time (ADR-0008).
 */
export function useApi<T>(path: string): ApiState<T> & { reload: () => Promise<void> } {
  const [state, setState] = useState<ApiState<T>>({ status: 'loading' });

  const reload = useCallback(async () => {
    const result = await getJson<T>(path);
    setState(
      result.ok ? { status: 'ready', data: result.data } : { status: 'error', error: result.error },
    );
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
