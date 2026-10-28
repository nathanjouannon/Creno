'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LogoutButton } from '@/components/LogoutButton';
import { useToast } from '@/components/Toast';
import { deleteJson, getJson } from '@/lib/api-client';

interface Props {
  firstName: string;
}

/**
 * First-name menu at the top right (design/components.md, "UserMenu"). States: closed, open (E1), focus.
 * "Supprimer mon compte" (F-11): the server refuses the last administrator at the click (E3, RG-04), otherwise the
 * confirmation opens (E2). The dialog lives outside the panel, which closes on a click outside of itself.
 */
export function UserMenu({ firstName }: Props) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { showToast } = useToast();
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

  async function startDeletion() {
    setChecking(true);
    const result = await getJson('/api/me/deletion-check');
    setChecking(false);
    setOpen(false);
    if (result.ok) setConfirming(true);
    else showToast({ tone: 'danger', message: result.error.message });
  }

  async function deleteAccount() {
    const result = await deleteJson('/api/me');
    // A full load so no page keeps what the deleted user could see
    if (result.ok) window.location.assign('/connexion');
    return result;
  }

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
          <Button variant="secondary" size="inline" loading={checking} onClick={startDeletion}>
            <span className="text-danger">Supprimer mon compte</span>
          </Button>
        </div>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          variant="delete"
          title="Supprimer mon compte ?"
          onConfirm={deleteAccount}
          onClose={() => setConfirming(false)}
        >
          Ton nom, ton prénom et ton e-mail seront effacés. Tes inscriptions futures seront libérées.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
