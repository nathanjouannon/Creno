import { AppHeader } from '@/components/AppHeader';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { errorCatalog } from '@creno/validation';
import { Link } from '@/components/Link';
import { getPageUser } from '@/modules/auth';

export const metadata = { title: 'Page introuvable' };

export default async function NotFound() {
  const user = await getPageUser();

  return (
    <>
      <AppHeader user={user} />
      <PageContainer narrow>
        <PageTitle>Page introuvable</PageTitle>
        <p className="text-text-muted">{errorCatalog.NOT_FOUND.message}</p>
        <Link href="/">Retour à l&apos;accueil</Link>
      </PageContainer>
    </>
  );
}
