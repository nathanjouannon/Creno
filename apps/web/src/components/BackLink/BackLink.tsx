import Link from 'next/link';

/** « ‹ Membres » above a detail page (design/components.md, "PageTitle / BackLink"). */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="text-small text-text-muted hover:text-text">
      ‹ {children}
    </Link>
  );
}
