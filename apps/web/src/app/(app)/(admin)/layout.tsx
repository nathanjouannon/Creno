import type { ReactNode } from 'react';
import { errorCatalog } from '@creno/validation';
import { Alert } from '@/components/Alert';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { requirePageUser } from '@/modules/auth';

/**
 * Pages reserved for administrators (F-03, RG-14). A user gets the refusal instead of the page. This only hides the
 * screen: pages of this group load their data through the API, which checks the role on every request.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();

  if (user.role !== 'ADMIN') {
    return (
      <PageContainer narrow>
        <PageTitle>Accès refusé</PageTitle>
        <Alert>{errorCatalog.FORBIDDEN.message}</Alert>
      </PageContainer>
    );
  }
  return children;
}
