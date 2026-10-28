import type { ReactNode } from 'react';
import { AppFooter } from '@/components/AppFooter';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

export const metadata = { title: 'Créno' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col">
        <ToastProvider>{children}</ToastProvider>
        <AppFooter />
      </body>
    </html>
  );
}
