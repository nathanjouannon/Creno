import type { ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { requirePageUser } from '@/modules/auth';

export const dynamic = 'force-dynamic';

/** Every page of a signed-in user: the header and the navigation by role (flow 00). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();

  return (
    <>
      <AppHeader user={user} />
      {children}
    </>
  );
}
