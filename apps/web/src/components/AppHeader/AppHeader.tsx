import Link from 'next/link';
import { MainNav } from '@/components/MainNav';
import { UserMenu } from '@/components/UserMenu';

interface Props {
  /** Signed-in user: shows the user menu and the navigation. Without it, the `public` variant (logo alone). */
  user?: { firstName: string; role: 'USER' | 'ADMIN' } | null;
}

/** `public` variant (A1 to A11) and `authenticated` variant (logo, user menu, navigation by role). */
export function AppHeader({ user }: Props) {
  return (
    <>
      <header className="flex items-center justify-between gap-md border-b border-border bg-surface px-md py-sm">
        <Link href="/" className="text-large font-bold text-text">
          Créno
        </Link>
        {user ? <UserMenu firstName={user.firstName} /> : null}
      </header>
      {user ? <MainNav variant={user.role === 'ADMIN' ? 'admin' : 'user'} /> : null}
    </>
  );
}
