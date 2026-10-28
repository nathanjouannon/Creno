import { BackLink } from '@/components/BackLink';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { ProfileForm } from '@/components/ProfileForm';
import { requirePageUser } from '@/modules/auth';

export const metadata = { title: 'Mon profil' };

// F-20, RG-18: the signed-in user's own name, first name and address; nobody else's.
export default async function ProfilePage() {
  const user = await requirePageUser();
  return (
    <PageContainer narrow>
      <BackLink href="/events">Événements</BackLink>
      <PageTitle>Mon profil</PageTitle>
      <ProfileForm user={user} />
    </PageContainer>
  );
}
