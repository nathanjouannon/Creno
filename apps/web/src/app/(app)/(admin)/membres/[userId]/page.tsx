import { PageContainer } from '@/components/PageContainer';
import { requirePageUser } from '@/modules/auth';
import { MemberScreen } from '../_screens/MemberScreen';

export const metadata = { title: 'Membre' };

// D2, D4, D5 (F-10, RG-04): the actions depend on the member and on who is looking.
export default async function MemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId }, viewer] = await Promise.all([params, requirePageUser()]);
  return (
    <PageContainer>
      <MemberScreen userId={userId} viewerId={viewer.id} />
    </PageContainer>
  );
}
