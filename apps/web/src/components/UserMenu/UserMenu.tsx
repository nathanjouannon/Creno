'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LogoutButton } from '@/components/LogoutButton';

interface Props {
  firstName: string;
}

/**
 * First-name menu at the top right (design/components.md, "UserMenu"). "Supprimer mon compte" joins it with the
 * account deletion ticket. States: closed, open, focus.
 */
export function UserMenu({ firstName }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex h-control items-center gap-sm rounded-button px-sm hover:bg-background"
      >
        <span
          aria-hidden="true"
          className="flex h-avatar w-avatar items-center justify-center rounded-tag bg-primary text-small font-medium text-on-primary"
        >
          {firstName.charAt(0).toUpperCase()}
        </span>
        <span className="font-medium text-text">{firstName}</span>
        <span aria-hidden="true" className="text-text-muted">
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-none z-10 mt-xs flex w-max flex-col gap-xs rounded-card border border-border bg-background p-sm"
        >
          <LogoutButton />
        </div>
      ) : null}
    </div>
  );
}
