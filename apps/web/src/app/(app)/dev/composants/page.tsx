import { notFound } from 'next/navigation';
import { ComponentGallery } from '@/components/ComponentGallery';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';

export const metadata = { title: 'Composants' };

// Development only: in production the page does not exist.
export default function ComponentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <PageContainer>
      <PageTitle>Composants</PageTitle>
      <ComponentGallery />
    </PageContainer>
  );
}
