import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { LoginForm } from '@/components/LoginForm';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { safeDestination } from '@/lib/destination';
import { getPageUser } from '@/modules/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connexion' };

// A5 to A7 (F-02). `?suite=` is the page asked before being sent here (flow 02, "retour à la page demandée").
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string | string[] }>;
}) {
  const { suite } = await searchParams;
  const destination = safeDestination(Array.isArray(suite) ? suite[0] : suite);

  // Already signed in: nothing to do here
  if (await getPageUser()) redirect(destination ?? '/events');

  return (
    <>
      <AppHeader />
      <PageContainer narrow>
        <PageTitle>Connexion</PageTitle>
        <LoginForm destination={destination} />
        <p className="text-small text-text-muted">
          Mot de passe oublié ? Contacte un administrateur du club.
        </p>
      </PageContainer>
    </>
  );
}
