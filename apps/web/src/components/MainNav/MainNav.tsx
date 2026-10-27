'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Variant = 'user' | 'admin';

const userTabs = [{ href: '/events', label: 'Événements' }];
const adminTabs = [
  ...userTabs,
  { href: '/events/past', label: 'Passés' },
  { href: '/membres', label: 'Membres' },
];

interface Props {
  variant: Variant;
}

/**
 * Tabs under the header (design/components.md, "MainNav"). The administrator tabs are never rendered for a user;
 * the real protection stays on the server (RG-14).
 */
export function MainNav({ variant }: Props) {
  const pathname = usePathname();
  const tabs = variant === 'admin' ? adminTabs : userTabs;
  // The most specific tab wins: /events/past belongs to "Passés", not to "Événements"
  const active = tabs
    .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label="Navigation principale" className="border-b border-border bg-background">
      <ul className="mx-auto flex max-w-content gap-md px-md">
        {tabs.map((tab) => {
          const current = tab === active;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? 'page' : undefined}
                className={`flex h-control items-center border-b ${
                  current
                    ? 'border-b-primary font-medium text-text'
                    : 'border-b-transparent text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
