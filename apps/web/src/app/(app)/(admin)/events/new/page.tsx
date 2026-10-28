import { PageContainer } from '@/components/PageContainer';
import { EventFormScreen } from '../../../events/_screens/EventFormScreen';

export const metadata = { title: 'Créer un événement' };

// C4, C5 (F-04): the administrator guard is in the (admin) layout; the API checks the role again.
export default function NewEventPage() {
  return (
    <PageContainer>
      <EventFormScreen />
    </PageContainer>
  );
}
