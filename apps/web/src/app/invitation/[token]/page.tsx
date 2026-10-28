import { AppError } from '@creno/validation';
import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/Alert';
import { InvitationSignupForm } from '@/components/InvitationSignupForm';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { getInvitationsService } from '@/modules/invitations';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Créer mon compte' };

// A1 to A4 (F-01, RG-02): public. An unknown, expired or deleted link shows the same message instead of the form.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationsService()
    .check(token)
    .catch((error: unknown) => {
      if (error instanceof AppError && error.code === 'INVITATION_INVALID') return null;
      throw error;
    });

  return (
    <>
      <AppHeader />
      <PageContainer narrow>
        {invitation ? (
          <>
            <PageTitle>Créer mon compte</PageTitle>
            <p className="text-text">
              {invitation.clubName} t&apos;invite à rejoindre l&apos;événement «{' '}
              {invitation.eventTitle} ».
            </p>
            <InvitationSignupForm token={token} eventId={invitation.eventId} />
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
