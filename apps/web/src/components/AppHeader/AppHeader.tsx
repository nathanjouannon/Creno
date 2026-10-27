import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';

interface Props {
  /** Signed-in user: shows the first name and the sign-out button. Without it, the `public` variant (logo alone). */
  user?: { firstName: string } | null;
}

/**
 * `public` variant (A1 to A11) and a provisional `authenticated` one: the user menu with "Supprimer mon compte" and
 * the navigation come with T-010 and T-020.
 */
export function AppHeader({ user }: Props) {
  return (
    <header className="flex items-center justify-between gap-md border-b border-border bg-surface px-md py-sm">
      <Link href="/" className="text-large font-bold text-text">
        Créno
      </Link>
      {user ? (
        <div className="flex items-center gap-sm">
          <span className="font-medium text-text">{user.firstName}</span>
          <LogoutButton />
        </div>
      ) : null}
    </header>
  );
}
