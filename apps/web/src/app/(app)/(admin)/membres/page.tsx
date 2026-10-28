import { PageContainer } from '@/components/PageContainer';
import { MemberListScreen } from './_screens/MemberListScreen';

export const metadata = { title: 'Membres' };

// D1 (F-10): the members, for administrators only (the layout refuses users; the API too, RG-14).
export default function MembersPage() {
  return (
    <PageContainer>
      <MemberListScreen />
    </PageContainer>
  );
}
