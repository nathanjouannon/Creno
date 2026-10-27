import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';

export const metadata = { title: 'Créer un événement' };

// Provisional (C4): the form comes with T-015. It exists now so that the administrator guard has a real page.
export default function NewEventPage() {
  return (
    <PageContainer>
      <PageTitle>Créer un événement</PageTitle>
    </PageContainer>
  );
}
