import type { ReactNode } from 'react';

type Variant = 'danger' | 'warning';

const variants: Record<Variant, string> = {
  danger: 'border-danger bg-danger-surface',
  warning: 'border-warning bg-warning-surface',
};

interface Props {
  variant?: Variant;
  children: ReactNode;
}

/** Message shown in the page. The meaning is in the text, never in the colour alone. */
export function Alert({ variant = 'danger', children }: Props) {
  return (
    <div role="alert" className={`rounded-card border p-md text-text ${variants[variant]}`}>
      {children}
    </div>
  );
}
