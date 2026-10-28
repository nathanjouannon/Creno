import { PageContainer } from '@/components/PageContainer';
import { requirePageUser } from '@/modules/auth';
import { EventScreen } from '../_screens/EventScreen';

export const metadata = { title: 'Événement' };

// C2 for an administrator (F-04, F-05), read only once the event is past (RG-15). Volunteer actions: T-015.
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const [{ eventId }, user] = await Promise.all([params, requirePageUser()]);
  return (
    <PageContainer>
      <EventScreen eventId={eventId} isAdmin={user.role === 'ADMIN'} />
    </PageContainer>
  );
}
