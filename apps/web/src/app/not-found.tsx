import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { errorCatalog } from '@creno/validation';

export const metadata = { title: 'Page introuvable' };

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <PageContainer narrow>
        <PageTitle>Page introuvable</PageTitle>
        <p className="text-text-muted">{errorCatalog.NOT_FOUND.message}</p>
        <Link href="/" className="text-primary hover:underline">
          Retour à l&apos;accueil
        </Link>
      </PageContainer>
    </>
  );
}
