'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

interface Props {
  title: string;
  /** Escape, a click on the backdrop and "Annuler" call this. Ignored while `busy`. */
  onClose: () => void;
  /** An action is running: the window cannot be dismissed. */
  busy?: boolean;
  children: ReactNode;
}

/**
 * Shell shared by `ConfirmDialog` and `LinkDialog` (design/components.md, section 5): centred window, backdrop,
 * focus kept inside, Escape to close, focus given back to what opened it.
 */
export function Modal({ title, onClose, busy = false, children }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // The first control is the safe one ("Annuler" or "Fermer"), never a destructive action
    dialog.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => opener?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialog.current) return;
    const controls = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (controls.length === 0) {
      event.preventDefault();
      return;
    }
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className="fixed inset-none z-30 flex items-center justify-center bg-overlay p-md"
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-modal flex-col gap-md rounded-card bg-background p-md"
      >
        <h2 id={titleId} className="text-large font-bold text-text">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
