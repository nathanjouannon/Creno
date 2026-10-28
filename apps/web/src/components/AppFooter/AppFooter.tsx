import { Link } from '@/components/Link';

/** Footer of every page (design/components.md, "AppFooter"): the link to the information notice (T-021). */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border px-md py-md text-small text-text-muted">
      <Link href="/mentions">Mentions d&apos;information</Link>
    </footer>
  );
}
