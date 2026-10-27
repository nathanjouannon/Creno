import type { ReactNode } from 'react';

interface Props {
  /** Public forms (A1 to A11) use the narrow width. */
  narrow?: boolean;
  children: ReactNode;
}

export function PageContainer({ narrow = false, children }: Props) {
  return (
    <main
      className={`mx-auto flex w-full flex-col gap-md p-md ${narrow ? 'max-w-form' : 'max-w-content'}`}
    >
      {children}
    </main>
  );
}
