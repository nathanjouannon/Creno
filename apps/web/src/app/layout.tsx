import type { ReactNode } from 'react';
import { AppFooter } from '@/components/AppFooter';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

export const metadata = { title: 'Créno' };

// security.md, section 4 (#80): every page is rendered per request, so its scripts carry the nonce of its policy (a
// page built in advance would have none, and the browser would block its scripts).
export const dynamic = 'force-dynamic';

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
