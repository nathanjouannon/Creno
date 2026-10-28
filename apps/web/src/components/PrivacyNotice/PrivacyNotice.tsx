import { Link } from '@/components/Link';

/** Reminder under the sign-up fields (design/components.md, "PrivacyNotice"; security.md, section 4). */
export function PrivacyNotice() {
  return (
    <p className="text-small text-text-muted">
      Le club garde ton nom, ton prénom et ton e-mail pour organiser les bénévoles.{' '}
      <Link href="/mentions" target="_blank" rel="noopener">
        Mentions d&apos;information
        <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
      </Link>
    </p>
  );
}
