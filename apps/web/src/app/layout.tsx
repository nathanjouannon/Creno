import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

export const metadata = { title: 'Créno' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
