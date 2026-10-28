import { AppError } from '@creno/validation';
import { Alert } from '@/components/Alert';
import { AppHeader } from '@/components/AppHeader';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';
import { getPasswordResetService } from '@/modules/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nouveau mot de passe' };

// A8, A9 (F-02, RG-12): public. An unknown, used, replaced or expired link shows the same message instead of the form.
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await getPasswordResetService()
    .check(token)
    .then(() => true)
    .catch((error: unknown) => {
      if (error instanceof AppError && error.code === 'AUTH_RESET_LINK_INVALID') return false;
      throw error;
    });

  return (
    <>
      <AppHeader />
      <PageContainer narrow>
        {valid ? (
          <>
            <PageTitle>Nouveau mot de passe</PageTitle>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <>
            <PageTitle>Lien invalide</PageTitle>
            <Alert>
              Ce lien n&apos;est plus valide, demande un nouveau lien à un administrateur.
            </Alert>
          </>
        )}
      </PageContainer>
    </>
  );
}
