import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { getPageUser } from '@/modules/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Événements' };

// Provisional list (B2): the real one comes with T-013 and T-015, the page guard with T-010.
export default async function EventsPage() {
  const user = await getPageUser();

  return (
    <>
      <AppHeader user={user} />
      <PageContainer>
        <PageTitle>Événements</PageTitle>
        <EmptyState>Aucun événement à venir pour le moment.</EmptyState>
      </PageContainer>
    </>
  );
}
