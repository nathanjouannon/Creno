import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';

export const metadata = { title: 'Événements' };

// Provisional list (B2): the real one comes with T-013 and T-015. The header and the guard are in the (app) layout.
export default function EventsPage() {
  return (
    <PageContainer>
      <PageTitle>Événements</PageTitle>
      <EmptyState>Aucun événement à venir pour le moment.</EmptyState>
    </PageContainer>
  );
}
