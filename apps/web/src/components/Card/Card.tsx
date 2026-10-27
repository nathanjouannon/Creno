import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'default' | 'selected' | 'alert';

// design/components.md, "Card": the border carries the variant, the text always says what it means too
const variants: Record<Variant, string> = {
  default: 'border-border',
  selected: 'border-primary',
  alert: 'border-danger',
};

interface Props {
  variant?: Variant;
  /** Makes the whole card a link (`clickable`: arrow ›, hover and focus states). */
  href?: string;
  children: ReactNode;
}

export function Card({ variant = 'default', href, children }: Props) {
  const base = `rounded-card border bg-background p-md ${variants[variant]}`;
  if (!href) return <div className={base}>{children}</div>;
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-md hover:bg-surface ${base}`}
    >
      <div className="min-w-none flex-1">{children}</div>
      <span aria-hidden="true" className="text-text-muted">
        ›
      </span>
    </Link>
  );
}
