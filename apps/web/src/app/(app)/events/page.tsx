import { PageContainer } from '@/components/PageContainer';
import { requirePageUser } from '@/modules/auth';
import { EventListScreen } from './_screens/EventListScreen';

export const metadata = { title: 'Événements' };

// B1, C1 (F-04, F-06): upcoming and ongoing events. The administrator also gets « Créer un événement ».
export default async function EventsPage() {
  const user = await requirePageUser();
  return (
    <PageContainer>
      <EventListScreen scope="upcoming" isAdmin={user.role === 'ADMIN'} />
    </PageContainer>
  );
}
