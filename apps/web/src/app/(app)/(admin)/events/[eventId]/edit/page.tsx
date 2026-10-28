import { PageContainer } from '@/components/PageContainer';
import { EventFormScreen } from '../../../../events/_screens/EventFormScreen';

export const metadata = { title: "Modifier l'événement" };

// C4 in modification (F-04 S4): the registrations are kept.
export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return (
    <PageContainer>
      <EventFormScreen eventId={eventId} />
    </PageContainer>
  );
}
