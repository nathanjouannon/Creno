import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { InstallForm } from '@/components/InstallForm';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { getClubService } from '@/modules/club';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Installer Créno' };

// A10 (F-19, RG-17): reachable while no user exists, "not found" afterwards.
export default async function InstallationPage() {
  if (await getClubService().isInstalled()) notFound();

  // Listed on the server so the server and the browser render the same options
  const timezones = Intl.supportedValuesOf('timeZone');

  return (
    <>
      <AppHeader />
      <PageContainer narrow>
        <PageTitle>Installer Créno</PageTitle>
        <InstallForm timezones={timezones.includes('UTC') ? timezones : [...timezones, 'UTC']} />
      </PageContainer>
    </>
  );
}
