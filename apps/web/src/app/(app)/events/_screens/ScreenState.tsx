'use client';

import type { ReactNode } from 'react';
import { Alert } from '@/components/Alert';
import type { ApiState } from '@/lib/use-api';

/** Loading and error states of a screen that reads the API; `children` renders the data once it is there. */
export function ScreenState<T>({
  state,
  children,
}: {
  state: ApiState<T>;
  children: (data: T) => ReactNode;
}) {
  if (state.status === 'loading')
    return (
      <p role="status" className="text-text-muted">
        Chargement…
      </p>
    );
  if (state.status === 'error') return <Alert>{state.error.message}</Alert>;
  return <>{children(state.data)}</>;
}

/** Both resources ready at once (the club gives the time zone, RG-16). */
export function both<A, B>(a: ApiState<A>, b: ApiState<B>): ApiState<[A, B]> {
  if (a.status === 'error') return a;
  if (b.status === 'error') return b;
  if (a.status === 'loading' || b.status === 'loading') return { status: 'loading' };
  return { status: 'ready', data: [a.data, b.data] };
}
