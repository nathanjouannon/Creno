import { PageContainer } from '@/components/PageContainer';
import { EventListScreen } from '../../../events/_screens/EventListScreen';

export const metadata = { title: 'Événements passés' };

// C9 (F-09, RG-09): past events, for administrators only (the layout refuses users; the API too).
export default function PastEventsPage() {
  return (
    <PageContainer>
      <EventListScreen scope="past" isAdmin />
    </PageContainer>
  );
}
