import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/** Text link (design/components.md, "Link"). Underlined so the meaning never relies on the colour alone. */
export function Link({ className = '', ...rest }: ComponentProps<typeof NextLink>) {
  return <NextLink {...rest} className={`text-primary underline hover:bg-surface ${className}`} />;
}
