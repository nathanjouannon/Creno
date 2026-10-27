import Link from 'next/link';

/** `public` variant: the logo alone (screens A1 to A11). The authenticated variant comes with the user menu. */
export function AppHeader() {
  return (
    <header className="border-b border-border bg-surface px-md py-sm">
      <Link href="/" className="text-large font-bold text-text">
        Créno
      </Link>
    </header>
  );
}
