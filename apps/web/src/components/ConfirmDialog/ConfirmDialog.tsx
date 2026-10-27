'use client';

import { useState, type ReactNode } from 'react';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import type { ApiResult } from '@/lib/api-client';
import { Modal } from './Modal';

export type ConfirmDialogVariant = 'unregister' | 'delete' | 'remove-registration';

// design/components.md, "ConfirmDialog": the action button depends on the case
const actions: Record<ConfirmDialogVariant, { label: string; button: 'primary' | 'danger' }> = {
  unregister: { label: 'Me désinscrire', button: 'primary' },
  delete: { label: 'Supprimer', button: 'danger' },
  'remove-registration': { label: 'Retirer', button: 'danger' },
};

interface Props {
  variant: ConfirmDialogVariant;
  /** A question ("Supprimer cet événement ?"). */
  title: string;
  /** What will happen, with the figures the rule asks for (RG-10: the number of registrations). */
  children: ReactNode;
  /** Runs the action. On success the dialog closes; on failure it stays open and shows the API message. */
  onConfirm: () => Promise<ApiResult>;
  onClose: () => void;
}

/** Modal window asking for confirmation. States: open, submitting (buttons blocked), error (API message). */
export function ConfirmDialog({ variant, title, children, onConfirm, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = actions[variant];

  async function confirm() {
    setSubmitting(true);
    setError(null);
    const result = await onConfirm();
    setSubmitting(false);
    if (result.ok) onClose();
    else setError(result.error.message);
  }

  return (
    <Modal title={title} onClose={onClose} busy={submitting}>
      <div className="text-text">{children}</div>
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex justify-between gap-sm">
        <Button variant="secondary" size="inline" disabled={submitting} onClick={onClose}>
          Annuler
        </Button>
        <Button variant={action.button} size="inline" loading={submitting} onClick={confirm}>
          {action.label}
        </Button>
      </div>
    </Modal>
  );
}
