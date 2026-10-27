import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'block' | 'inline';

// design/components.md, section 3: one `primary` per screen. States hover, focus (global), disabled and loading.
const variantClasses: Record<Variant, string> = {
  primary: 'border border-primary bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-border-strong bg-background text-text hover:bg-surface',
  danger: 'border border-danger bg-danger text-on-primary',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'block',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  const sizeClasses = size === 'block' ? 'w-full' : 'w-auto';
  return (
    <button
      type="button"
      {...rest}
      // The label stays while loading; the action is blocked so a form is never sent twice
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-control items-center justify-center gap-sm rounded-button px-md font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-text-muted ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-icon w-icon animate-spin rounded-full border border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
